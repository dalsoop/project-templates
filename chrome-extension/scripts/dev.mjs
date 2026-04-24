import { logStep, printLoadInstructions } from "./lib.mjs";

async function main() {
  logStep("개발용 빌드 완료");
  printLoadInstructions();
  process.stdout.write("팝업에서 '진단 다시 실행'으로 현재 탭 연결 상태를 바로 확인할 수 있습니다.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
