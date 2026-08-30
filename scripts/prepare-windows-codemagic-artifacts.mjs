import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "dist-desktop");
const instructionsPath = path.join(outDir, "HOW_TO_OPEN_WINDOWS_BUILD.txt");

const entries = await readdir(outDir, { withFileTypes: true }).catch(() => null);
if (!entries) {
  throw new Error(`Missing ${outDir}. Run npm run desktop:dist:win first.`);
}

const names = entries.map((entry) => entry.name);
const exes = names.filter((name) => name.toLowerCase().endsWith(".exe"));
const zips = names.filter((name) => name.toLowerCase().endsWith(".zip"));

if (exes.length === 0 && zips.length === 0) {
  throw new Error(`No Windows .exe or .zip found under ${outDir}.\n${names.join("\n")}`);
}

const instructions = `Fortified Command Center — Windows download

Use the Codemagic workflow named "Fortified Command Center Windows Download"
(not the Web Build workflow and not the Mac Download workflow).

What to download
1. Prefer the standalone installer ending in .exe
   (for example: Fortified Command Center-0.1.0-win-x64.exe)
2. Or download the standalone .zip and extract it
3. Codemagic may also wrap files into "*_artifacts.zip" — unzip that first

How to install / open
1. Double-click the .exe installer
   OR unzip the .zip and run "Fortified Command Center.exe"
2. Windows SmartScreen may warn on an unsigned build:
   - More info → Run anyway
   - Or right-click the file → Properties → Unblock → Apply, then open it
3. The first launch starts a private local server and opens the dashboard window

The "Fortified Command Center Web Build" artifacts are not a Windows app.
`;

await writeFile(instructionsPath, instructions, "utf8");

console.log("Windows artifact summary:");
for (const name of [...exes, ...zips, "HOW_TO_OPEN_WINDOWS_BUILD.txt"]) {
  console.log(`  ${name}`);
}
