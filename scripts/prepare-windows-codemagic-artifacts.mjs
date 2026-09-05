import { copyFile, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { writeZipStore } from "./write-zip-store.mjs";

const root = process.cwd();
const outDir = path.join(root, "dist-desktop");
const instructionsName = "HOW_TO_OPEN_WINDOWS_BUILD.txt";
const instructionsPath = path.join(outDir, instructionsName);
const installerName = "Install Fortified Command Center.exe";

const instructions = `Fortified Command Center — Windows download

Use the Codemagic workflow named "Fortified Command Center Windows Download"
(not the Web Build workflow and not the Mac Download workflow).

Codemagic does not list .exe files as standalone downloads. Bare installers are
packed into a generic "*_artifacts.zip", which is easy to mistake for the app.
The standalone .zip from this workflow contains the Windows installer.

What to download
1. Prefer the standalone .zip named like:
   Fortified Command Center-*-win-x64.zip
2. If you only see "*_artifacts.zip", unzip that first — the installer is inside

How to install / open
1. Unzip the download
2. Double-click "Install Fortified Command Center.exe"
3. Finish the installer. It creates Desktop and Start Menu shortcuts.
4. Open "Fortified Command Center" from the Desktop or Start Menu
5. Windows SmartScreen may warn on an unsigned build:
   - More info → Run anyway
   - Or right-click the file → Properties → Unblock → Apply, then open it
6. The first launch opens a "Starting local server" window, then the dashboard.
   This can take a couple of minutes while Windows Defender scans the unsigned app.
   If Windows says "Not responding", leave it open — do not force-close it yet.
   If you see "failed to start", choose Retry. The log is at:
   %APPDATA%\\Fortified Command Center\\desktop-server.log

The "Fortified Command Center Web Build" artifacts are not a Windows app.
`;

const entries = await readdir(outDir, { withFileTypes: true }).catch(() => null);
if (!entries) {
  throw new Error(`Missing ${outDir}. Run npm run desktop:dist:win first.`);
}

const topLevelFiles = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
const installerCandidates = topLevelFiles.filter(
  (name) => name.toLowerCase().endsWith(".exe") && name !== installerName,
);

if (installerCandidates.length === 0) {
  throw new Error(
    `No Windows NSIS installer .exe found under ${outDir}.\n${topLevelFiles.join("\n")}`,
  );
}

const winNamed = installerCandidates.filter((name) => /-win-/i.test(name));
const sourceInstaller = (winNamed.length > 0 ? winNamed : installerCandidates).sort((a, b) =>
  a.localeCompare(b),
)[0];
const publishedInstallerPath = path.join(outDir, installerName);
await copyFile(path.join(outDir, sourceInstaller), publishedInstallerPath);

const version = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version;
const zipName = `Fortified Command Center-${version}-win-x64.zip`;
const zipPath = path.join(outDir, zipName);

await writeFile(instructionsPath, instructions, "utf8");

// Replace electron-builder's unpacked-folder zip (a pile of DLLs) with a zip
// Codemagic can list as a first-class download that contains the installer.
for (const name of topLevelFiles) {
  if (name.toLowerCase().endsWith(".zip")) {
    await unlink(path.join(outDir, name));
  }
}

await writeZipStore(zipPath, [
  { name: installerName, data: await readFile(publishedInstallerPath) },
  { name: instructionsName, data: Buffer.from(instructions, "utf8") },
]);

const published = await readdir(outDir);
console.log("Windows artifact summary:");
for (const name of published.filter(
  (item) =>
    item === installerName ||
    item === zipName ||
    item === instructionsName ||
    item.toLowerCase().endsWith(".exe"),
)) {
  console.log(`  ${name}`);
}
