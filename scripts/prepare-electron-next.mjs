import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const staticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standaloneDir))) {
  throw new Error("Missing .next/standalone. Run `npm run build` after enabling Next standalone output.");
}

await mkdir(path.join(standaloneDir, ".next"), { recursive: true });

if (await exists(staticDir)) {
  await cp(staticDir, path.join(standaloneDir, ".next", "static"), {
    recursive: true,
    force: true,
  });
}

if (await exists(publicDir)) {
  await cp(publicDir, path.join(standaloneDir, "public"), {
    recursive: true,
    force: true,
  });
}

console.log("Prepared .next/standalone for Electron packaging.");
