import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const publicDir = path.join(projectRoot, "public");

async function main() {
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });

  const manifestPath = path.join(distDir, "manifest.json");
  const rawManifest = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(rawManifest);

  manifest.background.service_worker = "src/background/service-worker.js";
  manifest.action.default_popup = "popup.html";
  manifest.action.default_icon = {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png"
  };
  manifest.icons = {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  };
  manifest.content_scripts[0].js = ["src/content/index.js"];

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
