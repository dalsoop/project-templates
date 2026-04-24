# laravel-template

`prelik-coding-store`에서 쇼핑몰 도메인 로직을 걷어내고, 재사용 가능한 코드 규약만 남긴 `laravel-template`이다.

이 저장소의 목적은 새 프로젝트를 시작할 때 아래 기준을 바로 강제하는 것이다.

- `declare(strict_types=1)` 기본화
- `final class` 기본화
- `App\Actions\...` 중심의 invokable 액션 패턴
- invokable 컨트롤러 패턴
- Pest + PHPStan + Pint + CaptainHook 기반 품질 게이트
- `phpmnd` 기반 매직 넘버 게이트
- 커스텀 PHPStan 규칙으로 규약 위반 조기 탐지
- GitHub Actions + GitLab CI 동시 지원

## 포함된 규약

### 코드 구조

- `app/Actions` 에 유스케이스 단위 액션을 둔다.
- `app/Support` 에 값 객체, DTO, 순수 지원 로직을 둔다.
- 컨트롤러는 얇게 유지하고 액션 호출만 담당한다.
- `Route::resource()` 대신 명시적 라우트 + invokable 컨트롤러를 사용한다.
- 새 액션은 `php artisan make:action Foo/Bar/BazAction` 으로 생성한다.
- 새 엔드포인트는 `php artisan make:endpoint Foo/Bar/Baz` 로 생성한다.

### 품질 기준

- PHP 8.3+
- Pest 테스트
- PHPStan level 8
- `final`, `strict_types`, 작은 파일 유지
- `config()` / `env()` 기본값 남용 금지
- 테스트 설명 한글 강제
- 매직 넘버는 enum / const 로 승격

### CI / 훅

- `.github/workflows/ci.yml`
- `.gitlab-ci.yml`
- `captainhook.json`

## 빠른 시작

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate

composer analyse
composer lint
composer test
```

## 주요 명령

```bash
php artisan make:endpoint Billing/StoreInvoice --test
php artisan make:action Billing/SyncBillingPortal
composer analyse
composer lint
composer test
composer ci
```

## 템플릿에 남긴 것

- `app/Http/Middleware/SetSecurityHeaders.php` — 기본 보안 헤더 패턴
- `tools/phpstan/Rules/*` — 프로젝트 규약을 코드로 강제
- `stubs/*` — 생성 파일도 규약을 따르도록 수정된 Laravel 스텁
- `tests/Pest.php` — Feature / Unit 기본 Pest 설정
- `make:endpoint` — 액션 + invokable 컨트롤러 생성 경로

## 의도적으로 뺀 것

- 쇼핑몰 도메인 모델
- 결제, 구독, 다운로드, 라이선스 같은 비즈니스 패키지
- Filament, Fortify, Stripe, GitLab 연동

이 템플릿은 도메인을 제공하지 않는다. 대신 어떤 도메인이 와도 같은 품질 기준으로 시작하도록 설계했다.

## 권장 사용 순서

1. 저장소 이름과 `composer.json` 패키지명을 프로젝트에 맞게 변경한다.
2. `.env.example` 의 `APP_NAME`, `PROJECT_*` 값을 바꾼다.
3. 필요 없는 예제 페이지와 예제 액션을 지우고 실제 도메인으로 대체한다.
4. 새 규약이 필요하면 `tools/phpstan/Rules` 와 `stubs/` 에 먼저 반영한다.

## 라이선스

MIT
