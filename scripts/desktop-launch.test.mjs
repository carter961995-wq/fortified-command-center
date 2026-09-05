import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const require = createRequire(import.meta.url);
const launch = require("../electron/desktop-launch.cjs");

async function withTempDir(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fortified-launch-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("chooseListenPort uses the preferred port without bind-and-close", async () => {
  const checked = [];
  const result = await launch.chooseListenPort(43111, {
    checkPort: async (port) => {
      checked.push(port);
      return false;
    },
  });
  assert.deepEqual(result, { port: 43111, reused: false });
  assert.deepEqual(checked, [43111]);
});

test("chooseListenPort skips a busy port and does not reuse a foreign server", async () => {
  const result = await launch.chooseListenPort(43111, {
    checkPort: async (port) => port === 43111,
    probeHealth: async () => ({ ok: true, statusCode: 200, body: JSON.stringify({ ok: true, service: "something-else" }) }),
  });
  assert.deepEqual(result, { port: 43112, reused: false });
});

test("chooseListenPort reuses our own health endpoint", async () => {
  const result = await launch.chooseListenPort(43111, {
    checkPort: async () => true,
    probeHealth: async () => ({
      ok: true,
      statusCode: 200,
      body: JSON.stringify({ ok: true, service: "fortified-command-center" }),
    }),
  });
  assert.deepEqual(result, { port: 43111, reused: true });
});

test("buildServerEnv forces loopback, demo mode, and a node shim path", async () => {
  await withTempDir(async (dir) => {
    const appRoot = path.join(dir, "app");
    await mkdir(path.join(appRoot, "node_modules", "next"), { recursive: true });
    const shim = launch.createNodeShim({
      binDir: path.join(dir, "bin"),
      execPath: "/tmp/Fortified Command Center.exe",
      platform: "win32",
    });
    const env = launch.buildServerEnv({
      processEnv: { PATH: "C:\\Windows\\System32", HOSTNAME: "DESKTOP-BOX", NEXT_PUBLIC_DEMO_MODE: undefined },
      port: 43111,
      userDataDir: path.join(dir, "data"),
      execPath: "/tmp/Fortified Command Center.exe",
      shimDir: shim.binDir,
      appRoot,
    });

    assert.equal(env.HOSTNAME, "127.0.0.1");
    assert.equal(env.HOST, "127.0.0.1");
    assert.equal(env.PORT, "43111");
    assert.equal(env.NEXT_PUBLIC_DEMO_MODE, "true");
    assert.equal(env.ELECTRON_RUN_AS_NODE, "1");
    assert.match(env.PATH, /bin/);
    assert.match(await readFile(shim.files[0], "utf8"), /ELECTRON_RUN_AS_NODE=1/);
  });
});

test("inspectStandaloneRoot reports missing Next modules", async () => {
  await withTempDir(async (dir) => {
    await writeFile(path.join(dir, "server.js"), "console.log('ok')");
    const inspect = launch.inspectStandaloneRoot(dir);
    assert.equal(inspect.hasServer, true);
    assert.equal(inspect.hasNextModule, false);
    assert.match(inspect.missing.join("\n"), /Packaged Node modules are missing/);
  });
});

test("waitForHttpReady succeeds on a live health endpoint", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "fortified-command-center" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const result = await launch.waitForHttpReady(`http://127.0.0.1:${port}/api/health`, { timeoutMs: 2000 });
    assert.equal(result.statusCode, 200);
    assert.equal(launch.isOurHealthResponse(result), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("resolveStandaloneRoot prefers a nested server that still has Next modules", async () => {
  await withTempDir(async (dir) => {
    const resources = path.join(dir, "resources");
    const nested = path.join(resources, "app", "workspace");
    await mkdir(path.join(nested, "node_modules", "next"), { recursive: true });
    await writeFile(path.join(nested, "server.js"), "ok");
    assert.equal(launch.resolveStandaloneRoot(resources), nested);
  });
});
