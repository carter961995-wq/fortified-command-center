const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

let serverProcess = null;
let mainWindow = null;
let logStream = null;
let serverReady = false;

if (process.platform === "win32") {
  app.disableHardwareAcceleration();
  app.setAppUserModelId("com.fortifiedfence.commandcenter");
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  if (logStream) {
    logStream.write(`${line}\n`);
  }
}

function openLog() {
  try {
    const logPath = path.join(app.getPath("userData"), "desktop-server.log");
    logStream = fs.createWriteStream(logPath, { flags: "a" });
    log(`Log file: ${logPath}`);
  } catch (error) {
    console.error("Could not open desktop log file", error);
  }
}

function setSplashStatus(message, detail) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return;
  }
  const script = `window.__setStatus && window.__setStatus(${JSON.stringify(message)}, ${JSON.stringify(detail || "")})`;
  mainWindow.webContents.executeJavaScript(script).catch(() => {});
}

function getFreePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (error) => {
      if (preferredPort) {
        getFreePort().then(resolve).catch(reject);
        return;
      }
      reject(error);
    });
    server.listen(preferredPort || 0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not allocate a local port."));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function waitForServer(url, attempts = 90) {
  return new Promise((resolve, reject) => {
    let remaining = attempts;
    const startedAt = Date.now();

    function tryRequest() {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      setSplashStatus("Starting local server…", `This can take up to a minute on first launch (${elapsed}s).`);

      const request = http.get(url, { timeout: 2500 }, (response) => {
        response.resume();
        resolve();
      });

      request.on("timeout", () => {
        request.destroy();
        retry();
      });

      request.on("error", () => {
        retry();
      });
    }

    function retry() {
      remaining -= 1;
      if (remaining <= 0) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tryRequest, 500);
    }

    tryRequest();
  });
}

function resolveStandaloneRoot() {
  const root = path.join(process.resourcesPath, "app");
  if (fs.existsSync(path.join(root, "server.js"))) {
    return root;
  }

  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const nested = path.join(root, entry.name);
      if (fs.existsSync(path.join(nested, "server.js"))) {
        return nested;
      }
    }
  } catch (error) {
    log(`Could not scan standalone app folder: ${error instanceof Error ? error.message : String(error)}`);
  }

  return root;
}

function stopServerProcess() {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  const child = serverProcess;
  serverProcess = null;

  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }

  child.kill();
}

async function startBundledNextServer() {
  const preferredPort = Number(process.env.FORTIFIED_DESKTOP_PORT || 43111);
  const port = await getFreePort(preferredPort);
  const appRoot = resolveStandaloneRoot();
  const serverPath = path.join(appRoot, "server.js");
  const userDataDir = app.getPath("userData");

  if (!fs.existsSync(serverPath)) {
    throw new Error(`Packaged server file is missing:\n${serverPath}`);
  }

  log(`Starting bundled server from ${serverPath} on 127.0.0.1:${port}`);
  setSplashStatus("Starting local server…", "Loading the dashboard runtime.");

  let stderrTail = "";
  serverReady = false;

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: appRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      ELECTRON_NO_ATTACH_CONSOLE: "1",
      NODE_ENV: "production",
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE ?? "true",
      FORTIFIED_USER_DATA_DIR: userDataDir,
      GOOGLE_REDIRECT_URI:
        process.env.GOOGLE_REDIRECT_URI ||
        (port === preferredPort ? `http://127.0.0.1:${preferredPort}/api/integrations/google/callback` : ""),
      HOST: "127.0.0.1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const capture = (chunk, writer) => {
    const text = chunk.toString();
    writer(text.trim());
    stderrTail = `${stderrTail}${text}`.slice(-4000);
  };

  serverProcess.stdout.on("data", (chunk) => capture(chunk, (text) => log(`[next] ${text}`)));
  serverProcess.stderr.on("data", (chunk) => capture(chunk, (text) => log(`[next:err] ${text}`)));

  const url = `http://127.0.0.1:${port}`;

  await new Promise((resolve, reject) => {
    let settled = false;

    const succeed = () => {
      if (settled) return;
      settled = true;
      serverReady = true;
      resolve();
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    serverProcess.on("error", fail);
    serverProcess.on("exit", (code) => {
      if (!serverReady) {
        fail(
          new Error(
            `The local app server exited before it was ready (code ${code}).${stderrTail ? `\n\n${stderrTail}` : ""}`,
          ),
        );
        return;
      }
      if (code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox(
          "Fortified Command Center stopped",
          "The local app server stopped unexpectedly. Close the app and open it again.",
        );
      }
    });

    waitForServer(url).then(succeed).catch(fail);
  });

  return url;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: "Fortified Command Center",
    backgroundColor: "#060d1d",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 800);

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, url) => {
    if (errorCode === -3) return;
    log(`Window failed to load ${url}: ${errorCode} ${errorDescription}`);
    setSplashStatus("Dashboard failed to load", `${errorDescription} (${errorCode})`);
  });
}

async function showStartupError(error) {
  const message = error instanceof Error ? error.message : String(error);
  log(`Startup failed: ${message}`);
  setSplashStatus("Could not start Command Center", message);

  if (!mainWindow || mainWindow.isDestroyed()) {
    dialog.showErrorBox("Fortified Command Center failed to start", message);
    return;
  }

  const choice = dialog.showMessageBoxSync(mainWindow, {
    type: "error",
    title: "Fortified Command Center failed to start",
    message: "The dashboard window opened, but the local server did not become ready.",
    detail: message,
    buttons: ["Close"],
  });
  if (choice === 0) {
    app.quit();
  }
}

async function startApp() {
  openLog();
  createWindow();
  await mainWindow.loadFile(path.join(__dirname, "splash.html"));
  setSplashStatus("Starting Fortified Command Center…", "Opening a local dashboard window.");

  try {
    const startUrl = app.isPackaged
      ? await startBundledNextServer()
      : process.env.ELECTRON_START_URL ?? "http://localhost:3000";

    if (!app.isPackaged) {
      setSplashStatus("Connecting to the dev server…", startUrl);
      await waitForServer(startUrl, 40);
    }

    setSplashStatus("Opening dashboard…", startUrl);
    await mainWindow.loadURL(startUrl);
  } catch (error) {
    await showStartupError(error);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(startApp).catch((error) => {
    dialog.showErrorBox(
      "Fortified Command Center failed to start",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  stopServerProcess();
  if (logStream) {
    logStream.end();
    logStream = null;
  }
});
