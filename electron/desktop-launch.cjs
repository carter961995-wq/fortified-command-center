const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

const PREFERRED_PORT = 43111;
const HEALTH_PATH = "/api/health";
const DASHBOARD_PATH = "/dashboard";
const SERVER_WAIT_MS = 180_000;
const REQUEST_TIMEOUT_MS = 2500;
const RETRY_DELAY_MS = 400;

function asErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function pathExists(target) {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

function listDir(target) {
  try {
    return fs.readdirSync(target);
  } catch {
    return [];
  }
}

function hasNextModule(root) {
  return pathExists(path.join(root, "node_modules", "next")) || pathExists(path.join(root, "server_modules", "next"));
}

function resolveStandaloneRoot(resourcesPath) {
  const candidates = [path.join(resourcesPath, "app"), path.join(resourcesPath, "next-server")];
  const roots = [];

  for (const root of candidates) {
    if (pathExists(path.join(root, "server.js"))) {
      roots.push(root);
    }
    if (!pathExists(root)) continue;
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const nested = path.join(root, entry.name);
        if (pathExists(path.join(nested, "server.js"))) {
          roots.push(nested);
        }
      }
    } catch {
      // Ignore unreadable extra-resource folders.
    }
  }

  const withServer = roots.length > 0 ? roots : candidates.filter((root) => pathExists(root));
  const withModules = withServer.find(hasNextModule);
  return withModules || withServer[0] || candidates[0];
}

function inspectStandaloneRoot(appRoot) {
  const serverPath = path.join(appRoot, "server.js");
  const nextFromNodeModules = path.join(appRoot, "node_modules", "next");
  const nextFromServerModules = path.join(appRoot, "server_modules", "next");
  const missing = [];

  if (!pathExists(serverPath)) missing.push(`Packaged server file is missing:\n${serverPath}`);
  if (!pathExists(nextFromNodeModules) && !pathExists(nextFromServerModules)) {
    missing.push(
      `Packaged Node modules are missing. Expected Next.js at:\n${nextFromNodeModules}\nor\n${nextFromServerModules}`,
    );
  }

  return {
    appRoot,
    serverPath,
    hasServer: pathExists(serverPath),
    hasNextModule: hasNextModule(appRoot),
    missing,
    listing: listDir(appRoot).slice(0, 40),
  };
}

function moduleSearchPath(appRoot) {
  const entries = [path.join(appRoot, "node_modules"), path.join(appRoot, "server_modules")].filter((entry) =>
    pathExists(entry),
  );
  const parentModules = path.join(path.dirname(appRoot), "node_modules");
  if (pathExists(parentModules)) entries.push(parentModules);
  return entries;
}

function createNodeShim({ binDir, execPath, platform = process.platform }) {
  fs.mkdirSync(binDir, { recursive: true });
  if (platform === "win32") {
    const cmdPath = path.join(binDir, "node.cmd");
    const batPath = path.join(binDir, "node.bat");
    const body = `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${execPath}" %*\r\n`;
    fs.writeFileSync(cmdPath, body);
    fs.writeFileSync(batPath, body);
    return { binDir, files: [cmdPath, batPath] };
  }

  const shPath = path.join(binDir, "node");
  fs.writeFileSync(shPath, `#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\nexec "${execPath}" "$@"\n`, { mode: 0o755 });
  return { binDir, files: [shPath] };
}

function buildServerEnv({
  processEnv,
  port,
  userDataDir,
  execPath,
  shimDir,
  appRoot,
  preferredPort = PREFERRED_PORT,
}) {
  const nodePathParts = moduleSearchPath(appRoot);
  const pathKey = processEnv.Path && !processEnv.PATH ? "Path" : "PATH";
  const originalPath = processEnv[pathKey] || processEnv.PATH || processEnv.Path || "";
  const pathParts = [shimDir, ...originalPath.split(path.delimiter).filter(Boolean)].filter(Boolean);

  return {
    ...processEnv,
    ELECTRON_RUN_AS_NODE: "1",
    ELECTRON_NO_ATTACH_CONSOLE: "1",
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_DEMO_MODE: processEnv.NEXT_PUBLIC_DEMO_MODE === "false" ? "false" : "true",
    FORTIFIED_USER_DATA_DIR: userDataDir,
    HOST: "127.0.0.1",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    NODE_PATH: nodePathParts.join(path.delimiter),
    npm_node_execpath: execPath,
    NODE: execPath,
    [pathKey]: pathParts.join(path.delimiter),
    GOOGLE_REDIRECT_URI:
      processEnv.GOOGLE_REDIRECT_URI ||
      (Number(port) === Number(preferredPort) ? `http://127.0.0.1:${preferredPort}/api/integrations/google/callback` : ""),
  };
}

function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(400);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function httpGet(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          ok: true,
          statusCode: response.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    request.on("timeout", () => {
      request.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    request.on("error", (error) => {
      resolve({ ok: false, error: asErrorMessage(error) });
    });
  });
}

function isOurHealthResponse(result) {
  if (!result?.ok) return false;
  if (result.statusCode !== 200) return false;
  try {
    const payload = JSON.parse(result.body);
    return payload?.ok === true && payload?.service === "fortified-command-center";
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chooseListenPort(preferredPort = PREFERRED_PORT, { checkPort = isPortInUse, probeHealth = httpGet } = {}) {
  const preferredInUse = await checkPort(preferredPort);
  if (!preferredInUse) return { port: preferredPort, reused: false };

  const health = await probeHealth(`http://127.0.0.1:${preferredPort}${HEALTH_PATH}`);
  if (isOurHealthResponse(health)) {
    return { port: preferredPort, reused: true };
  }

  for (let port = preferredPort + 1; port < preferredPort + 30; port += 1) {
    if (!(await checkPort(port))) {
      return { port, reused: false };
    }
  }

  throw new Error("Could not find a free local port for the dashboard server.");
}

async function waitForHttpReady(url, { timeoutMs = SERVER_WAIT_MS, onAttempt, requestTimeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const startedAt = Date.now();
  let attempt = 0;
  let lastError = "not started";

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;
    const elapsedMs = Date.now() - startedAt;
    if (onAttempt) onAttempt({ attempt, elapsedMs, url });
    const result = await httpGet(url, requestTimeoutMs);
    if (result.ok && result.statusCode > 0 && result.statusCode < 500) {
      return result;
    }
    lastError = result.error || `HTTP ${result.statusCode || "no response"}`;
    await delay(RETRY_DELAY_MS);
  }

  throw new Error(`Timed out waiting for ${url} (${lastError})`);
}

function healthUrl(origin) {
  return `${origin}${HEALTH_PATH}`;
}

function dashboardUrl(origin) {
  return `${origin}${DASHBOARD_PATH}`;
}

function looksLikeAddressInUse(text) {
  return /EADDRINUSE|address already in use/i.test(String(text || ""));
}

function formatStartupError({ message, logPath, inspect }) {
  const parts = [message];
  if (inspect?.listing?.length) {
    parts.push(`Packaged server folder contains: ${inspect.listing.join(", ")}`);
  }
  if (logPath) {
    parts.push(`Log file: ${logPath}`);
  }
  return parts.join("\n\n");
}

module.exports = {
  PREFERRED_PORT,
  HEALTH_PATH,
  DASHBOARD_PATH,
  SERVER_WAIT_MS,
  asErrorMessage,
  resolveStandaloneRoot,
  inspectStandaloneRoot,
  hasNextModule,
  moduleSearchPath,
  createNodeShim,
  buildServerEnv,
  isPortInUse,
  httpGet,
  isOurHealthResponse,
  chooseListenPort,
  waitForHttpReady,
  healthUrl,
  dashboardUrl,
  looksLikeAddressInUse,
  formatStartupError,
};
