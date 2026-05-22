const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");

let serverProcess = null;
let mainWindow = null;

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

function waitForServer(url, attempts = 120) {
  return new Promise((resolve, reject) => {
    let remaining = attempts;

    function tryRequest() {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        remaining -= 1;
        if (remaining <= 0) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tryRequest, 500);
      });
    }

    tryRequest();
  });
}

async function startBundledNextServer() {
  const preferredPort = Number(process.env.FORTIFIED_DESKTOP_PORT || 43111);
  const port = await getFreePort(preferredPort);
  const appRoot = path.join(process.resourcesPath, "app");
  const serverPath = path.join(appRoot, "server.js");
  const userDataDir = app.getPath("userData");

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: appRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE ?? "true",
      FORTIFIED_USER_DATA_DIR: userDataDir,
      GOOGLE_REDIRECT_URI:
        process.env.GOOGLE_REDIRECT_URI ||
        (port === preferredPort ? `http://127.0.0.1:${preferredPort}/api/integrations/google/callback` : ""),
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: "pipe",
  });

  serverProcess.stdout.on("data", (chunk) => {
    console.log(`[next] ${chunk.toString().trim()}`);
  });
  serverProcess.stderr.on("data", (chunk) => {
    console.error(`[next] ${chunk.toString().trim()}`);
  });
  serverProcess.on("exit", (code) => {
    if (code !== 0 && mainWindow) {
      dialog.showErrorBox("Fortified Command Center stopped", "The local app server stopped unexpectedly.");
    }
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

async function createWindow() {
  const startUrl = app.isPackaged
    ? await startBundledNextServer()
    : process.env.ELECTRON_START_URL ?? "http://localhost:3000";

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: "Fortified Command Center",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  await mainWindow.loadURL(startUrl);
}

app.whenReady().then(createWindow).catch((error) => {
  dialog.showErrorBox("Fortified Command Center failed to start", error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
