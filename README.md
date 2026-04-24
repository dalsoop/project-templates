# project-templates

프로젝트 시작 템플릿 모노레포.

## 템플릿 목록

| 템플릿 | 설명 |
|--------|------|
| [laravel/](./laravel/) | Laravel + PHPStan lv8, Pest, Pint, CaptainHook |
| [wordpress-plugin/](./wordpress-plugin/) | WordPress 플러그인 (cargo-generate 스타일, GPL) |
| [rust/](./rust/) | Rust + hardcoded-lint fail-closed 게이트 (AI 하드코딩 차단) |
| [chrome-extension/](./chrome-extension/) | Chrome 확장 MV3 (DOM-hiding, strict TypeScript) |
| [renpy/](./renpy/) | Ren'Py + command bridge scaffold |

## 사용법

### cargo-generate (Rust 템플릿)

```bash
cargo generate dalsoop/project-templates --name my-app
```

`--template` 플래그로 서브디렉토리 지정:

```bash
cargo generate dalsoop/project-templates/rust --name my-app
cargo generate dalsoop/project-templates/wordpress-plugin --name my-plugin
```

## 관련

- [proxmox-init](https://github.com/dalsoop/proxmox-init) — Proxmox/LXC 서버 환경 초기화
- [mac-init](https://github.com/dalsoop/mac-init) — macOS 개발환경 초기화
