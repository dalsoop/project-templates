<?php
/**
 * Module manager — RankMath-inspired pattern.
 *
 * Modules are self-contained feature units that can be activated/deactivated
 * independently from the plugin settings page.
 *
 * @package {{PLUGIN_NAMESPACE}}
 */

declare( strict_types=1 );

namespace {{PLUGIN_NAMESPACE}};

defined( 'ABSPATH' ) || exit;

final class Modules {

	/** @var array<string, string> slug => FQCN */
	private array $registered = [];

	/** @var array<string, object> slug => instance */
	private array $booted = [];

	public function register( string $slug, string $class_name ): void {
		$this->registered[ $slug ] = $class_name;
	}

	/**
	 * @param array<string, string> $modules
	 */
	public function register_many( array $modules ): void {
		foreach ( $modules as $slug => $class_name ) {
			$this->register( (string) $slug, (string) $class_name );
		}
	}

	public function boot_active(): void {
		$active = $this->active_slugs();

		foreach ( $this->registered as $slug => $class_name ) {
			if ( ! in_array( $slug, $active, true ) ) {
				continue;
			}
			if ( ! class_exists( $class_name ) ) {
				continue;
			}

			$instance = new $class_name();
			if ( method_exists( $instance, 'boot' ) ) {
				$instance->boot();
			}

			$this->booted[ $slug ] = $instance;
		}

		do_action( '{{PLUGIN_PREFIX}}/modules_booted', $this->booted );
	}

	public function get( string $slug ): ?object {
		return $this->booted[ $slug ] ?? null;
	}

	public function is_active( string $slug ): bool {
		return in_array( $slug, $this->active_slugs(), true );
	}

	/**
	 * @return list<string>
	 */
	public function active_slugs(): array {
		$settings = (array) get_option( '{{PLUGIN_PREFIX}}_settings', [] );
		$enabled  = $settings['enabled_modules'] ?? [];

		return array_values( array_filter( array_map( 'strval', (array) $enabled ) ) );
	}

	public function activate( string $slug ): bool {
		$slugs = $this->active_slugs();
		if ( in_array( $slug, $slugs, true ) ) {
			return true;
		}

		$slugs[] = $slug;
		return $this->save_active( $slugs );
	}

	public function deactivate( string $slug ): bool {
		$slugs = array_values( array_diff( $this->active_slugs(), [ $slug ] ) );
		return $this->save_active( $slugs );
	}

	/**
	 * @param list<string> $slugs
	 */
	private function save_active( array $slugs ): bool {
		$settings                    = (array) get_option( '{{PLUGIN_PREFIX}}_settings', [] );
		$settings['enabled_modules'] = $slugs;

		return (bool) update_option( '{{PLUGIN_PREFIX}}_settings', $settings );
	}

	/**
	 * @return array<string, string>
	 */
	public function all(): array {
		return $this->registered;
	}
}
