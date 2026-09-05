import { createRequire } from "node:module";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const afterPack = require("./ensure-packaged-standalone.cjs");
const { createFilter } = require("app-builder-lib/out/util/filter.js");

async function withTempDir(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fortified-pack-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("electron-builder extraResources filter drops root node_modules but not a fileset copied from node_modules itself", () => {
  const standaloneFilter = createFilter("/standalone", [{ match: () => true, negate: false }], null);
  const asDir = { isDirectory: () => true };

  assert.equal(standaloneFilter("/standalone", asDir), true);
  assert.equal(standaloneFilter("/standalone/node_modules", asDir), false);
  assert.equal(standaloneFilter("/standalone/server.js", { isDirectory: () => false }), true);

  const modulesFilter = createFilter("/standalone/node_modules", [{ match: () => true, negate: false }], null);
  assert.equal(modulesFilter("/standalone/node_modules", asDir), true);
  assert.equal(modulesFilter("/standalone/node_modules/next", asDir), true);
});

test("afterPack helper copies dropped Next modules next to a flattened server.js", async () => {
  await withTempDir(async (dir) => {
    const sourceDir = path.join(dir, "standalone");
    const destDir = path.join(dir, "resources", "app");
    await mkdir(path.join(sourceDir, "node_modules", "next"), { recursive: true });
    await writeFile(path.join(sourceDir, "server.js"), "ok");
    await writeFile(path.join(sourceDir, "node_modules", "next", "index.js"), "module.exports = {}");
    await mkdir(destDir, { recursive: true });
    await writeFile(path.join(destDir, "server.js"), "ok");

    const result = afterPack.ensureNodeModulesAtRoots({ sourceDir, destDir });
    assert.equal(result.copied.length, 1);
    assert.equal(fs.existsSync(path.join(destDir, "node_modules", "next", "index.js")), true);
  });
});

test("resolveResourcesDir finds Windows and Mac resource folders", async () => {
  await withTempDir(async (dir) => {
    const winResources = path.join(dir, "win-unpacked", "resources");
    await mkdir(winResources, { recursive: true });
    assert.equal(
      afterPack.resolveResourcesDir({ appOutDir: path.join(dir, "win-unpacked"), electronPlatformName: "win32" }),
      winResources,
    );

    const macApp = path.join(dir, "mac", "Fortified Command Center.app", "Contents", "Resources");
    await mkdir(macApp, { recursive: true });
    assert.equal(
      afterPack.resolveResourcesDir({
        appOutDir: path.join(dir, "mac"),
        electronPlatformName: "darwin",
        packager: { appInfo: { productFilename: "Fortified Command Center" } },
      }),
      macApp,
    );
  });
});
