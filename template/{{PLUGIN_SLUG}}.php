<?php
/**
 * Plugin Name:       {{PLUGIN_NAME}}
 * Plugin URI:        {{PLUGIN_URI}}
 * Description:       {{PLUGIN_DESCRIPTION}}
 * Version:           {{PLUGIN_VERSION}}
 * Requires at least: {{MIN_WP}}
 * Requires PHP:      {{MIN_PHP}}
 * Author:            {{AUTHOR_NAME}}
 * Author URI:        {{AUTHOR_URI}}
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       {{PLUGIN_SLUG}}
 * Domain Path:       /languages
 *
 * @package {{PLUGIN_NAMESPACE}}
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

define( '{{PLUGIN_CONST}}_VERSION', '{{PLUGIN_VERSION}}' );
define( '{{PLUGIN_CONST}}_FILE', __FILE__ );
define( '{{PLUGIN_CONST}}_PATH', plugin_dir_path( __FILE__ ) );
define( '{{PLUGIN_CONST}}_URL', plugin_dir_url( __FILE__ ) );
define( '{{PLUGIN_CONST}}_BASENAME', plugin_basename( __FILE__ ) );
define( '{{PLUGIN_CONST}}_MIN_PHP', '{{MIN_PHP}}' );
define( '{{PLUGIN_CONST}}_MIN_WP', '{{MIN_WP}}' );

// Bail early if PHP version is too low — register a notice instead of fataling.
if ( version_compare( PHP_VERSION, {{PLUGIN_CONST}}_MIN_PHP, '<' ) ) {
	add_action(
		'admin_notices',
		static function () {
			printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				esc_html(
					sprintf(
						/* translators: 1: required PHP version, 2: current PHP version */
						__( '{{PLUGIN_NAME}} requires PHP %1$s or higher. You are running %2$s.', '{{PLUGIN_SLUG}}' ),
						{{PLUGIN_CONST}}_MIN_PHP,
						PHP_VERSION
					)
				)
			);
		}
	);
	return;
}

// Built-in PSR-4-ish autoloader. Maps `{{PLUGIN_NAMESPACE}}\Foo\Bar_Baz`
// → `includes/foo/class-bar-baz.php`. Composer's autoloader, if present, takes
// precedence (registered first) — this is the fallback so the plugin works
// when shipped without `vendor/`.
if ( file_exists( {{PLUGIN_CONST}}_PATH . 'vendor/autoload.php' ) ) {
	require_once {{PLUGIN_CONST}}_PATH . 'vendor/autoload.php';
}

spl_autoload_register(
	static function ( string $class ): void {
		$prefix = '{{PLUGIN_NAMESPACE}}\\';
		if ( strpos( $class, $prefix ) !== 0 ) {
			return;
		}

		$relative = substr( $class, strlen( $prefix ) );
		$parts    = explode( '\\', $relative );
		$class_nm = array_pop( $parts );

		$dir = $parts === [] ? '' : strtolower( implode( '/', $parts ) ) . '/';
		$file = {{PLUGIN_CONST}}_PATH . 'includes/' . $dir . 'class-' . str_replace( '_', '-', strtolower( $class_nm ) ) . '.php';

		if ( file_exists( $file ) ) {
			require_once $file;
		}
	}
);

\{{PLUGIN_NAMESPACE}}\Plugin::instance()->boot();

register_activation_hook( __FILE__, [ \{{PLUGIN_NAMESPACE}}\Plugin::class, 'activate' ] );
register_deactivation_hook( __FILE__, [ \{{PLUGIN_NAMESPACE}}\Plugin::class, 'deactivate' ] );
