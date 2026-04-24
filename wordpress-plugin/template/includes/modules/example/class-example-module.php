<?php
/**
 * Example module — copy this directory to scaffold a new module.
 *
 * Steps:
 *   1. cp -r includes/modules/example includes/modules/your-slug
 *   2. Rename namespace + class
 *   3. Register in includes/class-plugin.php → register_modules()
 *
 * @package {{PLUGIN_NAMESPACE}}
 */

declare( strict_types=1 );

namespace {{PLUGIN_NAMESPACE}}\Modules\Example;

use {{PLUGIN_NAMESPACE}}\Helper;

defined( 'ABSPATH' ) || exit;

final class Example_Module {

	public function boot(): void {
		add_action( '{{PLUGIN_PREFIX}}/rest_init', [ $this, 'register_routes' ] );
	}

	public function register_routes(): void {
		register_rest_route(
			'{{PLUGIN_SLUG}}/v1',
			'/example',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'handle_get' ],
				'permission_callback' => static fn (): bool => Helper::has_cap( 'edit_posts' ),
			]
		);
	}

	public function handle_get( \WP_REST_Request $request ): \WP_REST_Response {
		return new \WP_REST_Response(
			[
				'module'  => 'example',
				'message' => __( 'Hello from the example module.', '{{PLUGIN_SLUG}}' ),
			],
			200
		);
	}
}
