import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { copyStandaloneBrowserAssets, copyStandaloneNodeModules, findStandaloneServerRoots } from "./lib/standalone-assets.mjs";

async function withTempDir(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fortified-standalone-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("copies CSS next to a nested standalone server.js", async () => {
  await withTempDir(async (dir) => {
    const standaloneDir = path.join(dir, "standalone");
    const staticDir = path.join(dir, "static");
    const publicDir = path.join(dir, "public");
    const nestedRoot = path.join(standaloneDir, "workspace");

    await mkdir(path.join(nestedRoot, ".next", "server"), { recursive: true });
    await mkdir(path.join(staticDir, "css"), { recursive: true });
    await mkdir(publicDir, { recursive: true });
    await writeFile(path.join(nestedRoot, "server.js"), "console.log('ok')");
    await writeFile(path.join(staticDir, "css", "app.css"), "body{color:red}");
    await writeFile(path.join(publicDir, "app-shell.css"), "body{background:#081326}");

    const result = await copyStandaloneBrowserAssets({ standaloneDir, staticDir, publicDir });
    assert.deepEqual(await findStandaloneServerRoots(standaloneDir), [nestedRoot]);
    assert.equal(result.cssCount, 1);
    assert.equal(await readFile(path.join(nestedRoot, ".next", "static", "css", "app.css"), "utf8"), "body{color:red}");
    assert.equal(await readFile(path.join(nestedRoot, "public", "app-shell.css"), "utf8"), "body{background:#081326}");
  });
});

test("copies Next modules next to a nested standalone server.js", async () => {
  await withTempDir(async (dir) => {
    const standaloneDir = path.join(dir, "standalone");
    const nestedRoot = path.join(standaloneDir, "workspace");
    await mkdir(path.join(standaloneDir, "node_modules", "next"), { recursive: true });
    await mkdir(nestedRoot, { recursive: true });
    await writeFile(path.join(nestedRoot, "server.js"), "console.log('ok')");
    await writeFile(path.join(standaloneDir, "node_modules", "next", "package.json"), JSON.stringify({ name: "next" }));

    const result = await copyStandaloneNodeModules(standaloneDir);
    assert.deepEqual(result.serverRoots, [nestedRoot]);
    assert.equal(await readFile(path.join(nestedRoot, "node_modules", "next", "package.json"), "utf8"), JSON.stringify({ name: "next" }));
  });
});

test("fails when the Next build emitted no CSS", async () => {
  await withTempDir(async (dir) => {
    const standaloneDir = path.join(dir, "standalone");
    const staticDir = path.join(dir, "static");
    await mkdir(standaloneDir, { recursive: true });
    await mkdir(staticDir, { recursive: true });
    await writeFile(path.join(standaloneDir, "server.js"), "console.log('ok')");

    await assert.rejects(
      () => copyStandaloneBrowserAssets({ standaloneDir, staticDir, publicDir: path.join(dir, "public") }),
      /No CSS files found/,
    );
  });
});
