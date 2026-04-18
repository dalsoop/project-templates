# {{PLUGIN_NAME}}

> {{PLUGIN_DESCRIPTION}}

[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2%2B-blue.svg)](https://www.gnu.org/licenses/gpl-2.0)
[![PHP Version](https://img.shields.io/badge/php-%3E%3D{{MIN_PHP}}-8892BF.svg)](https://www.php.net/)
[![WordPress](https://img.shields.io/badge/wordpress-%3E%3D{{MIN_WP}}-21759b.svg)](https://wordpress.org/)

## Architecture

```
{{PLUGIN_SLUG}}/
├── {{PLUGIN_SLUG}}.php          Main plugin file (header, constants, bootstrap)
├── uninstall.php                 Cleanup on uninstall
├── includes/
│   ├── class-plugin.php          Singleton, hook registration, autoloader
│   ├── class-modules.php         Module manager (enable/disable per feature)
│   ├── class-helper.php          Settings/capability/asset helpers
│   └── modules/
│       └── example/              Reference module — copy to scaffold new ones
├── src/
│   └── editor-sidebar.js         Gutenberg sidebar entry (JSX)
├── build/                        Built assets (gitignored, committed at release)
├── languages/                    Translations (.pot, .po, .mo)
└── vendor/                       Composer dependencies (optional — built-in autoloader works)
```

## Adding a Module

1. `cp -r includes/modules/example includes/modules/your-slug`
2. Rename namespace `Modules\Example` → `Modules\YourSlug` and class `Example_Module` → `Your_Module` (file: `class-your-module.php`)
3. Register in `includes/class-plugin.php → register_modules()`:

   ```php
   $modules = apply_filters( '{{PLUGIN_PREFIX}}/modules', [
       'example'   => Modules\Example\Example_Module::class,
       'your-slug' => Modules\YourSlug\Your_Module::class,
   ] );
   ```

4. Activate it in plugin settings, or via:
   ```php
   \{{PLUGIN_NAMESPACE}}\Plugin::instance()->modules()->activate( 'your-slug' );
   ```

## Build

```bash
npm install
npm run build           # outputs build/editor-sidebar.js + build/editor-sidebar.asset.php
npm start               # watch mode for development
```

The plugin works without `composer install` thanks to a built-in PSR-4 autoloader. Composer is only needed for dev tools (PHPUnit, PHPCS).

To add a second JS entry, edit `webpack.config.js`:

```js
entry: {
  'editor-sidebar': './src/editor-sidebar.js',
  'settings-page':  './src/settings-page.js',
},
```

## Testing

```bash
composer test           # PHPUnit
composer lint           # PHP_CodeSniffer (WPCS)
```

## License

GPL-2.0-or-later. See [LICENSE](./LICENSE).
