const fs = require("fs");
const path = require("path");

function pathExists(target) {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

function walkFor(dir, predicate, found = [], depth = 0) {
  if (depth > 8 || !pathExists(dir)) return found;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (predicate(entry, fullPath, dir)) found.push({ entry, fullPath, parent: dir });
    if (entry.isDirectory() && entry.name !== ".git") {
      walkFor(fullPath, predicate, found, depth + 1);
    }
  }
  return found;
}

function findServerRoots(dir) {
  return [...new Set(walkFor(dir, (entry) => entry.isFile() && entry.name === "server.js").map((item) => item.parent))];
}

function findNextModuleDirs(dir) {
  return [
    ...new Set(
      walkFor(
        dir,
        (entry, fullPath) =>
          entry.isDirectory() && entry.name === "next" && path.basename(path.dirname(fullPath)) === "node_modules",
      ).map((item) => path.dirname(item.fullPath)),
    ),
  ];
}

function copyDir(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true, dereference: true });
}

function findModulesWalkingUp(startDir, stopDir) {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, "node_modules");
    if (pathExists(path.join(candidate, "next"))) return candidate;
    if (current === stopDir) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function ensureNodeModulesAtRoots({ sourceDir, destDir }) {
  const fallbackSource = findModulesWalkingUp(sourceDir, sourceDir) || findNextModuleDirs(sourceDir)[0];
  if (!fallbackSource) {
    throw new Error(
      `No Next.js runtime found under ${sourceDir}. The desktop app cannot start without node_modules/next.`,
    );
  }

  const destRoots = findServerRoots(destDir);
  const roots = destRoots.length > 0 ? destRoots : [destDir];
  const copied = [];

  for (const root of roots) {
    if (pathExists(path.join(root, "node_modules", "next"))) continue;
    const relative = path.relative(destDir, root);
    const sourceRoot = !relative || relative === "." ? sourceDir : path.join(sourceDir, relative);
    const source = findModulesWalkingUp(sourceRoot, sourceDir) || fallbackSource;
    const dest = path.join(root, "node_modules");
    copyDir(source, dest);
    copied.push(dest);
  }

  const missing = roots.filter((root) => !pathExists(path.join(root, "node_modules", "next")));
  if (missing.length > 0) {
    throw new Error(`Failed to copy Next.js modules next to:\n${missing.join("\n")}`);
  }

  return { roots, copied, sourceModules: fallbackSource };
}

function resolveResourcesDir(context) {
  const appOutDir = context.appOutDir;
  const product = context.packager?.appInfo?.productFilename || "Fortified Command Center";
  const candidates =
    context.electronPlatformName === "darwin"
      ? [path.join(appOutDir, "Contents", "Resources"), path.join(appOutDir, `${product}.app`, "Contents", "Resources")]
      : [path.join(appOutDir, "resources")];

  const found = candidates.find((dir) => pathExists(dir));
  if (!found) {
    throw new Error(`Could not find packaged Resources directory. Looked in:\n${candidates.join("\n")}`);
  }
  return found;
}

async function afterPack(context) {
  const resourcesDir = resolveResourcesDir(context);
  const destDir = path.join(resourcesDir, "app");
  const sourceDir = path.join(process.cwd(), ".next", "standalone");

  if (!pathExists(destDir)) {
    throw new Error(`Packaged Next server folder is missing: ${destDir}`);
  }
  if (!pathExists(sourceDir)) {
    throw new Error(`Standalone build is missing: ${sourceDir}`);
  }

  const result = ensureNodeModulesAtRoots({ sourceDir, destDir });
  console.log(
    `Verified packaged Next runtime at ${destDir} (${result.roots.length} server root(s), copied ${result.copied.length} node_modules tree(s)).`,
  );
}

afterPack.ensureNodeModulesAtRoots = ensureNodeModulesAtRoots;
afterPack.findNextModuleDirs = findNextModuleDirs;
afterPack.findServerRoots = findServerRoots;
afterPack.resolveResourcesDir = resolveResourcesDir;

module.exports = afterPack;
