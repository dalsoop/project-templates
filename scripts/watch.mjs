import { watch } from "node:fs";
import path from "node:path";

import { logStep, packageJsonPath, projectRoot, publicDir, run } from "./lib.mjs";

const watchRoots = [
  path.join(projectRoot, "src"),
  publicDir,
  path.join(projectRoot, "tests"),
  path.join(projectRoot, "scripts"),
  packageJsonPath
];

let rebuildTimer = null;
let building = false;

async function rebuild(reason) {
  if (building) {
    return;
  }

  building = true;
  logStep(`변경 감지: ${reason}`);
  try {
    await run("npm", ["run", "build"]);
    process.stdout.write("[infocutter] 재빌드 완료\n");
  } catch (error) {
    console.error("[infocutter] 재빌드 실패", error);
  } finally {
    building = false;
  }
}

function scheduleRebuild(reason) {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
  }

  rebuildTimer = setTimeout(() => {
    void rebuild(reason);
  }, 200);
}

async function main() {
  await rebuild("초기 실행");
  logStep("watch 모드 시작");

  for (const root of watchRoots) {
    watch(root, { recursive: true }, (_eventType, filename) => {
      scheduleRebuild(`${root}:${filename ?? "changed"}`);
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
