import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const publicDir = path.join(projectRoot, "public");

async function main() {
  await mkdir(path.join(distDir, "public"), { recursive: true });
  await cp(publicDir, path.join(distDir, "public"), { recursive: true });

  const manifestPath = path.join(distDir, "public", "manifest.json");
  const rawManifest = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(rawManifest);

  manifest.background.service_worker = "src/background/service-worker.js";
  manifest.action.default_popup = "public/popup.html";
  manifest.content_scripts[0].js = ["src/content/index.js"];

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
