<?php
/**
 * Helper — settings, security, and option access wrappers.
 *
 * Borrowed pattern from RankMath's Helper class. Static methods only.
 *
 * @package {{PLUGIN_NAMESPACE}}
 */

declare( strict_types=1 );

namespace {{PLUGIN_NAMESPACE}};

defined( 'ABSPATH' ) || exit;

final class Helper {

	private const OPTION_KEY = '{{PLUGIN_PREFIX}}_settings';

	public static function get_settings( ?string $path = null, mixed $default = null ): mixed {
		$settings = (array) get_option( self::OPTION_KEY, [] );

		if ( $path === null ) {
			return $settings;
		}

		$keys  = explode( '.', $path );
		$value = $settings;
		foreach ( $keys as $key ) {
			if ( ! is_array( $value ) || ! array_key_exists( $key, $value ) ) {
				return $default;
			}
			$value = $value[ $key ];
		}

		return $value;
	}

	public static function update_settings( string $path, mixed $value ): bool {
		$settings = (array) get_option( self::OPTION_KEY, [] );
		$keys     = explode( '.', $path );
		$ref      = &$settings;

		foreach ( $keys as $key ) {
			if ( ! isset( $ref[ $key ] ) || ! is_array( $ref[ $key ] ) ) {
				$ref[ $key ] = [];
			}
			$ref = &$ref[ $key ];
		}
		$ref = $value;

		return (bool) update_option( self::OPTION_KEY, $settings );
	}

	public static function has_cap( string $capability = 'manage_options' ): bool {
		return current_user_can( $capability );
	}

	public static function verify_nonce( string $action, string $field = '_wpnonce' ): bool {
		$nonce = isset( $_REQUEST[ $field ] ) ? sanitize_text_field( wp_unslash( (string) $_REQUEST[ $field ] ) ) : '';
		return (bool) wp_verify_nonce( $nonce, $action );
	}

	public static function asset_url( string $relative_path ): string {
		return {{PLUGIN_CONST}}_URL . ltrim( $relative_path, '/' );
	}

	public static function asset_path( string $relative_path ): string {
		return {{PLUGIN_CONST}}_PATH . ltrim( $relative_path, '/' );
	}

	public static function is_rest_request(): bool {
		return defined( 'REST_REQUEST' ) && REST_REQUEST;
	}
}
