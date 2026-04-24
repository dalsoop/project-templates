import path from "node:path";
import process from "node:process";

import { distDir, fileExists, logStep, manifestPath, packageJsonPath, publicDir, readJson } from "./lib.mjs";

async function main() {
  logStep("환경 점검 시작");

  const packageJson = await readJson(packageJsonPath);
  const manifest = await readJson(manifestPath);
  const problems = [];

  if (packageJson.type !== "module") {
    problems.push("package.json 의 type 값이 module 이어야 합니다.");
  }

  if (manifest.manifest_version !== 3) {
    problems.push("manifest_version 은 3 이어야 합니다.");
  }

  const requiredPermissions = ["storage", "tabs", "contextMenus", "scripting"];
  for (const permission of requiredPermissions) {
    if (!manifest.permissions?.includes(permission)) {
      problems.push(`manifest 권한 누락: ${permission}`);
    }
  }

  const requiredIcons = [
    "icons/icon-16.png",
    "icons/icon-32.png",
    "icons/icon-48.png",
    "icons/icon-128.png"
  ];
  for (const iconPath of requiredIcons) {
    const iconExists = await fileExists(path.join(publicDir, iconPath));
    if (!iconExists) {
      problems.push(`아이콘 파일 누락: public/${iconPath}`);
    }
  }

  const distManifestExists = await fileExists(path.join(distDir, "manifest.json"));
  if (!distManifestExists) {
    problems.push("dist/manifest.json 이 없습니다. 먼저 npm run build 를 실행하세요.");
  }

  process.stdout.write(`Node: ${process.version}\n`);
  process.stdout.write(`Project: ${packageJson.name}@${packageJson.version}\n`);
  process.stdout.write(`Manifest: MV${manifest.manifest_version}\n`);

  if (problems.length > 0) {
    process.stderr.write("\n[infocutter] 진단 실패\n");
    for (const problem of problems) {
      process.stderr.write(`- ${problem}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write("\n[infocutter] 진단 통과\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
