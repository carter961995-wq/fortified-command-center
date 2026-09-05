import { access, cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

export async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function walkForServerJs(dir, found, depth = 0) {
  if (depth > 8) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === "server.js") {
      found.push(dir);
      continue;
    }
    if (entry.isDirectory()) {
      await walkForServerJs(fullPath, found, depth + 1);
    }
  }
}

export async function findStandaloneServerRoots(standaloneDir) {
  const roots = [];
  await walkForServerJs(standaloneDir, roots);
  return [...new Set(roots)];
}

export async function collectCssFiles(dir, found = [], depth = 0) {
  if (depth > 6 || !(await pathExists(dir))) return found;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectCssFiles(fullPath, found, depth + 1);
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      found.push(fullPath);
    }
  }
  return found;
}

export async function copyStandaloneBrowserAssets({ standaloneDir, staticDir, publicDir }) {
  if (!(await pathExists(standaloneDir))) {
    throw new Error("Missing .next/standalone. Run `npm run build` after enabling Next standalone output.");
  }

  const serverRoots = await findStandaloneServerRoots(standaloneDir);
  const targets = serverRoots.length > 0 ? serverRoots : [standaloneDir];

  if (!(await pathExists(staticDir))) {
    throw new Error(
      `Missing ${staticDir}. The Next build did not emit browser CSS/JS, so the desktop window would render as an unstyled document.`,
    );
  }

  const cssFiles = await collectCssFiles(staticDir);
  if (cssFiles.length === 0) {
    throw new Error(
      `No CSS files found in ${staticDir}. Packaging would ship an unstyled Command Center window.`,
    );
  }

  for (const root of targets) {
    await mkdir(path.join(root, ".next"), { recursive: true });
    await cp(staticDir, path.join(root, ".next", "static"), {
      recursive: true,
      force: true,
    });
    if (await pathExists(publicDir)) {
      await cp(publicDir, path.join(root, "public"), {
        recursive: true,
        force: true,
      });
    }
  }

  for (const root of targets) {
    const packagedCss = await collectCssFiles(path.join(root, ".next", "static"));
    if (packagedCss.length === 0) {
      throw new Error(`Failed to copy CSS next to standalone server at ${root}`);
    }
  }

  return {
    serverRoots: targets,
    cssCount: cssFiles.length,
  };
}

async function findNextModuleDir(dir) {
  const direct = path.join(dir, "node_modules", "next");
  if (await pathExists(direct)) return path.join(dir, "node_modules");

  const serverRoots = await findStandaloneServerRoots(dir);
  for (const root of [dir, ...serverRoots]) {
    let current = root;
    while (true) {
      const candidate = path.join(current, "node_modules");
      if (await pathExists(path.join(candidate, "next"))) return candidate;
      if (current === dir) break;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

export async function copyStandaloneNodeModules(standaloneDir) {
  const sourceModules = await findNextModuleDir(standaloneDir);
  if (!sourceModules) {
    throw new Error(
      `Standalone output is missing node_modules/next under ${standaloneDir}. The packaged desktop app would fail to start.`,
    );
  }

  const serverRoots = await findStandaloneServerRoots(standaloneDir);
  const targets = serverRoots.length > 0 ? serverRoots : [standaloneDir];
  const copied = [];

  for (const root of targets) {
    const dest = path.join(root, "node_modules");
    if (!(await pathExists(path.join(dest, "next")))) {
      await cp(sourceModules, dest, { recursive: true, force: true });
      copied.push(dest);
    }
  }

  for (const root of targets) {
    if (!(await pathExists(path.join(root, "node_modules", "next")))) {
      throw new Error(`Failed to place Next.js modules next to standalone server at ${root}`);
    }
  }

  return { serverRoots: targets, copied, sourceModules };
}
