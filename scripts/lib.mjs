import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const projectRoot = process.cwd();
export const distDir = path.join(projectRoot, "dist");
export const packageDir = path.join(projectRoot, "dist-package");
export const publicDir = path.join(projectRoot, "public");
export const packageJsonPath = path.join(projectRoot, "package.json");
export const manifestPath = path.join(publicDir, "manifest.json");

export function logStep(message) {
  process.stdout.write(`\n[infocutter] ${message}\n`);
}

export async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(targetPath) {
  const raw = await readFile(targetPath, "utf8");
  return JSON.parse(raw);
}

export async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
      ...options
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? -1}`));
    });

    child.on("error", reject);
  });
}

export function scriptPath(relativePath) {
  const currentFile = fileURLToPath(import.meta.url);
  return path.join(path.dirname(currentFile), relativePath);
}

export function printLoadInstructions() {
  process.stdout.write(
    [
      "",
      "Chrome load-unpacked steps:",
      `1. Open chrome://extensions`,
      "2. Enable 개발자 모드",
      "3. Click 'Load unpacked'",
      `4. Select: ${distDir}`,
      ""
    ].join("\n")
  );
}
