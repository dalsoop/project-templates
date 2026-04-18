<?php
/**
 * Fired when the plugin is uninstalled. Removes all plugin options and meta.
 *
 * @package {{PLUGIN_NAMESPACE}}
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( '{{PLUGIN_PREFIX}}_settings' );
delete_site_option( '{{PLUGIN_PREFIX}}_settings' );

global $wpdb;
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->postmeta} WHERE meta_key LIKE %s", '{{PLUGIN_PREFIX}}\\_%' ) );
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE %s", '{{PLUGIN_PREFIX}}\\_%' ) );
