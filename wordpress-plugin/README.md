# wp-plugin-template

A scaffold for modern WordPress plugins. Inspired by `cargo-generate` style — placeholders, a generator script, sensible defaults.

## What you get

A generated plugin with:

- **Modular architecture** — RankMath-style `Modules` manager. Each feature is a self-contained class that can be enabled/disabled in settings.
- **PSR-4 autoloading** via Composer.
- **Strict types** + PHP 8.0+ baseline.
- **REST API scaffold** — modules register their own routes via the `{prefix}/rest_init` action.
- **Gutenberg sidebar starter** (JSX, `@wordpress/scripts` compatible).
- **GPL-2.0+** licensed (mandatory for WordPress.org repo).
- **i18n-ready** — text domain wired up, `wp_set_script_translations` for editor JS.
- **WordPress Coding Standards** preset (`phpcs.xml`).
- **Activation/deactivation/uninstall hooks** wired up.
- **`.distignore`** for clean WordPress.org SVN deploys.

## Quick start

```bash
./bin/instantiate.sh \
  --name "SEO for Korean" \
  --target ../seo-for-korean \
  --author "Dalsoop" \
  --author-uri "https://github.com/dalsoop" \
  --vendor "dalsoop" \
  --description "Korean WordPress SEO. Naver-aware, AI-assisted, GPL."
```

That generates `../seo-for-korean/` with every placeholder substituted, a fresh git repo, and ready to `composer install && npm install`.

## Layout

```
wp-plugin-template/
├── template/                     ← every file here ships into the new plugin
│   ├── {{PLUGIN_SLUG}}.php       ← main plugin file (renamed on generation)
│   ├── uninstall.php
│   ├── readme.txt                ← WordPress.org format
│   ├── README.md                 ← GitHub format
│   ├── LICENSE                   ← GPL-2.0+
│   ├── composer.json
│   ├── phpcs.xml
│   ├── .gitignore
│   ├── .distignore
│   ├── includes/
│   │   ├── class-plugin.php      ← singleton bootstrap
│   │   ├── class-modules.php     ← module manager
│   │   ├── class-helper.php      ← settings / capability helpers
│   │   └── modules/example/      ← reference module — clone to scaffold new ones
│   ├── assets/admin/js/
│   │   └── editor-sidebar.jsx    ← Gutenberg PluginSidebar starter
│   └── languages/
├── bin/
│   └── instantiate.sh            ← generator (sed-based variable substitution)
├── wp-plugin-template.toml       ← placeholder manifest (`cargo-generate.toml` analogue)
└── README.md
```

## Placeholders

| Token | Source | Example |
|---|---|---|
| `{{PLUGIN_NAME}}` | required | `SEO for Korean` |
| `{{PLUGIN_SLUG}}` | derived from name | `seo-for-korean` |
| `{{PLUGIN_PREFIX}}` | derived from slug | `sfk` |
| `{{PLUGIN_NAMESPACE}}` | derived from name | `SEOForKorean` |
| `{{PLUGIN_CONST}}` | derived from prefix | `SFK` |
| `{{PLUGIN_DESCRIPTION}}` | optional | `Korean WordPress SEO.` |
| `{{PLUGIN_VERSION}}` | default `0.1.0` | `0.1.0` |
| `{{AUTHOR_NAME}}` | optional | `Dalsoop` |
| `{{AUTHOR_URI}}` | optional | `https://...` |
| `{{PLUGIN_URI}}` | derived from author | `https://.../seo-for-korean` |
| `{{COMPOSER_VENDOR}}` | optional | `dalsoop` |
| `{{MIN_PHP}}` | default `8.0` | `8.0` |
| `{{MIN_WP}}` | default `6.0` | `6.0` |
| `{{YEAR}}` | auto | `2026` |

Full spec: see [`wp-plugin-template.toml`](./wp-plugin-template.toml).

## Why this layout

| Decision | Reason |
|---|---|
| Composer + PSR-4 over old WPPB-style requires | Modern PHP. `composer install` handles autoload generation. |
| Module manager pattern (RankMath-inspired) | Lets you ship a small core and grow features as toggle-able modules. Future-proof. |
| `Helper::get_settings('a.b.c')` dot-path | Cleaner than nested array access scattered across the codebase. |
| `{prefix}/rest_init` action over central REST controller | Each module owns its routes. No god class. |
| `.distignore` from day one | WordPress.org SVN deploy step won't accidentally ship dev files. |
| `editor-sidebar.jsx` over plain JS | React/JSX is the actual Gutenberg world. `wp-scripts` builds it. |
| `strict_types=1` + PHP 8.0 baseline | Catches type bugs early. WordPress core itself supports 7.4+, but plugins targeting 8.0+ in 2026 is reasonable. |

## Adding a module after generation

```bash
cd your-plugin
cp -r includes/modules/example includes/modules/naver-seo
# edit naver-seo/class-example.php → namespace + class name
# register in includes/class-plugin.php → register_modules()
```

## License

GPL-2.0-or-later. The template itself, and everything it generates.
