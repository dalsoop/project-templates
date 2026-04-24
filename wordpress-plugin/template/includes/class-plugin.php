<?php
/**
 * Plugin bootstrap — singleton entrypoint, hook registration, activation.
 *
 * @package {{PLUGIN_NAMESPACE}}
 */

declare( strict_types=1 );

namespace {{PLUGIN_NAMESPACE}};

defined( 'ABSPATH' ) || exit;

final class Plugin {

	private static ?self $instance = null;

	private Modules $modules;

	public static function instance(): self {
		return self::$instance ??= new self();
	}

	private function __construct() {
		$this->modules = new Modules();
	}

	public function boot(): void {
		add_action( 'plugins_loaded', [ $this, 'load_textdomain' ] );
		add_action( 'init', [ $this, 'register_modules' ], 5 );
		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
		add_action( 'enqueue_block_editor_assets', [ $this, 'enqueue_editor_assets' ] );
	}

	public function load_textdomain(): void {
		load_plugin_textdomain(
			'{{PLUGIN_SLUG}}',
			false,
			dirname( {{PLUGIN_CONST}}_BASENAME ) . '/languages'
		);
	}

	public function register_modules(): void {
		/**
		 * Register modules. Each module is a class implementing a `boot(): void` method.
		 *
		 * Add new modules by appending to this filter.
		 *
		 * @param array<string, string> $modules Map of module slug => fully-qualified class name.
		 */
		$modules = apply_filters(
			'{{PLUGIN_PREFIX}}/modules',
			[
				'example' => Modules\Example\Example_Module::class,
			]
		);

		$this->modules->register_many( $modules );
		$this->modules->boot_active();
	}

	public function register_rest_routes(): void {
		// Modules with REST routes register them via their own boot() method.
		do_action( '{{PLUGIN_PREFIX}}/rest_init' );
	}

	public function enqueue_editor_assets(): void {
		$asset_file = {{PLUGIN_CONST}}_PATH . 'build/editor-sidebar.asset.php';
		$deps       = [ 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-i18n' ];
		$version    = {{PLUGIN_CONST}}_VERSION;

		if ( file_exists( $asset_file ) ) {
			$asset   = require $asset_file;
			$deps    = $asset['dependencies'] ?? $deps;
			$version = $asset['version'] ?? $version;
		}

		wp_enqueue_script(
			'{{PLUGIN_SLUG}}-editor-sidebar',
			{{PLUGIN_CONST}}_URL . 'build/editor-sidebar.js',
			$deps,
			$version,
			true
		);

		wp_set_script_translations(
			'{{PLUGIN_SLUG}}-editor-sidebar',
			'{{PLUGIN_SLUG}}',
			{{PLUGIN_CONST}}_PATH . 'languages'
		);
	}

	public static function activate(): void {
		// Defaults seed, capability registration, db migrations.
		add_option(
			'{{PLUGIN_PREFIX}}_settings',
			[
				'version'         => {{PLUGIN_CONST}}_VERSION,
				'enabled_modules' => [ 'example' ],
			]
		);
		flush_rewrite_rules();
	}

	public static function deactivate(): void {
		flush_rewrite_rules();
	}

	public function modules(): Modules {
		return $this->modules;
	}
}
