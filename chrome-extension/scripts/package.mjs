import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const packageDir = path.join(projectRoot, "dist-package");

async function main() {
  const packageJson = JSON.parse(
    await readFile(path.join(projectRoot, "package.json"), "utf8")
  );
  const version = packageJson.version;
  const archivePath = path.join(packageDir, `infocutter-v${version}.zip`);

  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });
  await execFileAsync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", distDir, archivePath], {
    cwd: projectRoot
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
