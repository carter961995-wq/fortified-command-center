import path from "node:path";
import { copyStandaloneBrowserAssets, copyStandaloneNodeModules } from "./lib/standalone-assets.mjs";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const result = await copyStandaloneBrowserAssets({
  standaloneDir,
  staticDir: path.join(root, ".next", "static"),
  publicDir: path.join(root, "public"),
});
const modules = await copyStandaloneNodeModules(standaloneDir);

console.log(
  `Prepared standalone desktop assets: ${result.cssCount} CSS file(s) copied next to ${result.serverRoots.length} server.js root(s).`,
);
console.log(`Prepared Next runtime: node_modules/next copied next to ${modules.serverRoots.length} server.js root(s).`);
for (const serverRoot of result.serverRoots) {
  console.log(`  - ${path.relative(root, serverRoot) || "."}`);
}
