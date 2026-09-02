import path from "node:path";
import { copyStandaloneBrowserAssets } from "./lib/standalone-assets.mjs";

const root = process.cwd();
const result = await copyStandaloneBrowserAssets({
  standaloneDir: path.join(root, ".next", "standalone"),
  staticDir: path.join(root, ".next", "static"),
  publicDir: path.join(root, "public"),
});

console.log(
  `Prepared standalone desktop assets: ${result.cssCount} CSS file(s) copied next to ${result.serverRoots.length} server.js root(s).`,
);
for (const serverRoot of result.serverRoots) {
  console.log(`  - ${path.relative(root, serverRoot) || "."}`);
}
