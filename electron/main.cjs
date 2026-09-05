const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  PREFERRED_PORT,
  asErrorMessage,
  resolveStandaloneRoot,
  inspectStandaloneRoot,
  createNodeShim,
  buildServerEnv,
  chooseListenPort,
  waitForHttpReady,
  healthUrl,
  dashboardUrl,
  looksLikeAddressInUse,
  formatStartupError,
} = require("./desktop-launch.cjs");

let serverProcess = null;
let mainWindow = null;
let logStream = null;
let logPath = null;
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
    logPath = path.join(app.getPath("userData"), "desktop-server.log");
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

function stopServerProcess() {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  const child = serverProcess;
  serverProcess = null;
  serverReady = false;

  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }

  child.kill();
}

function spawnBundledServer({ appRoot, serverPath, port, userDataDir, shimDir }) {
  const env = buildServerEnv({
    processEnv: process.env,
    port,
    userDataDir,
    execPath: process.execPath,
    shimDir,
    appRoot,
    preferredPort: PREFERRED_PORT,
  });

  log(`Starting bundled server from ${serverPath} on 127.0.0.1:${port}`);
  log(`Server folder listing: ${inspectStandaloneRoot(appRoot).listing.join(", ") || "(empty)"}`);

  const child = spawn(process.execPath, [serverPath], {
    cwd: appRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  return child;
}

async function startBundledNextServer() {
  const appRoot = resolveStandaloneRoot(process.resourcesPath);
  const inspect = inspectStandaloneRoot(appRoot);
  if (inspect.missing.length > 0) {
    throw new Error(inspect.missing.join("\n\n"));
  }

  const userDataDir = app.getPath("userData");
  const shim = createNodeShim({
    binDir: path.join(userDataDir, "bin"),
    execPath: process.execPath,
  });
  const selected = await chooseListenPort(PREFERRED_PORT);
  const origin = `http://127.0.0.1:${selected.port}`;

  if (selected.reused) {
    log(`Reusing an already-running local server at ${origin}`);
    setSplashStatus("Connecting…", origin);
    return origin;
  }

  setSplashStatus("Starting local server…", "Loading the dashboard runtime.");
  serverReady = false;

  let lastPort = selected.port;
  let lastInspect = inspect;
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = attempt === 0 ? selected.port : (await chooseListenPort(PREFERRED_PORT + attempt)).port;
    lastPort = port;
    let stderrTail = "";
    const child = spawnBundledServer({
      appRoot,
      serverPath: inspect.serverPath,
      port,
      userDataDir,
      shimDir: shim.binDir,
    });
    serverProcess = child;

    const capture = (chunk, writer) => {
      const text = chunk.toString();
      writer(text.trim());
      stderrTail = `${stderrTail}${text}`.slice(-4000);
    };

    child.stdout.on("data", (chunk) => capture(chunk, (text) => log(`[next] ${text}`)));
    child.stderr.on("data", (chunk) => capture(chunk, (text) => log(`[next:err] ${text}`)));

    try {
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

        child.on("error", fail);
        child.on("exit", (code) => {
          if (!serverReady) {
            fail(
              new Error(
                `The local app server exited before it was ready (code ${code}).${stderrTail ? `\n\n${stderrTail}` : ""}`,
              ),
            );
          } else if (code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
            dialog.showErrorBox(
              "Fortified Command Center stopped",
              "The local app server stopped unexpectedly. Close the app and open it again.",
            );
          }
        });

        waitForHttpReady(healthUrl(`http://127.0.0.1:${port}`), {
          onAttempt: ({ elapsedMs }) => {
            const seconds = Math.round(elapsedMs / 1000);
            setSplashStatus(
              "Starting local server…",
              `First launch can take a couple of minutes while Windows scans the app (${seconds}s).`,
            );
          },
        }).then(succeed).catch(fail);
      });

      return `http://127.0.0.1:${port}`;
    } catch (error) {
      lastError = error;
      lastInspect = inspectStandaloneRoot(appRoot);
      const message = asErrorMessage(error);
      log(`Server start attempt ${attempt + 1} failed: ${message}`);
      stopServerProcess();
      if (looksLikeAddressInUse(message) && attempt < 4) {
        continue;
      }
      break;
    }
  }

  throw new Error(
    formatStartupError({
      message: asErrorMessage(lastError) || `Could not start the local server on port ${lastPort}.`,
      logPath,
      inspect: lastInspect,
    }),
  );
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

function showStartupError(error) {
  const message = asErrorMessage(error);
  log(`Startup failed: ${message}`);
  setSplashStatus("Could not start Command Center", message);

  const detail = `${message}${logPath ? `\n\nLog file:\n${logPath}` : ""}`;

  if (!mainWindow || mainWindow.isDestroyed()) {
    dialog.showErrorBox("Fortified Command Center failed to start", detail);
    return "close";
  }

  const buttons = logPath ? ["Retry", "Open log", "Close"] : ["Retry", "Close"];
  const choice = dialog.showMessageBoxSync(mainWindow, {
    type: "error",
    title: "Fortified Command Center failed to start",
    message: "The local dashboard server did not become ready.",
    detail,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
  });

  if (buttons[choice] === "Retry") return "retry";
  if (buttons[choice] === "Open log" && logPath) {
    shell.openPath(logPath);
    return "retry";
  }
  return "close";
}

async function loadDashboard(startUrl) {
  const target = app.isPackaged ? dashboardUrl(startUrl) : startUrl;
  setSplashStatus("Opening dashboard…", target);
  await mainWindow.loadURL(target);
}

async function startApp() {
  openLog();
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  await mainWindow.loadFile(path.join(__dirname, "splash.html"));
  setSplashStatus("Starting Fortified Command Center…", "Opening a local dashboard window.");

  while (true) {
    try {
      const startUrl = app.isPackaged
        ? await startBundledNextServer()
        : process.env.ELECTRON_START_URL ?? "http://localhost:3000";

      if (!app.isPackaged) {
        setSplashStatus("Connecting to the dev server…", startUrl);
        await waitForHttpReady(startUrl, { timeoutMs: 40_000 });
      }

      await loadDashboard(startUrl);
      return;
    } catch (error) {
      stopServerProcess();
      const action = showStartupError(error);
      if (action !== "retry") {
        app.quit();
        return;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.loadFile(path.join(__dirname, "splash.html"));
      }
      setSplashStatus("Retrying…", "Starting the local server again.");
    }
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
      asErrorMessage(error),
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
