/**
 * Gutenberg sidebar — minimal scaffold.
 *
 * Build with esbuild/Vite/wp-scripts. Output to editor-sidebar.js + editor-sidebar.asset.php.
 * Recommended: `@wordpress/scripts` build (npm install --save-dev @wordpress/scripts).
 *
 * @package {{PLUGIN_NAMESPACE}}
 */

import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/edit-post';
import { PanelBody, PanelRow } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const SIDEBAR_NAME = '{{PLUGIN_SLUG}}-sidebar';

const Sidebar = () => (
	<>
		<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME }>
			{ __( '{{PLUGIN_NAME}}', '{{PLUGIN_SLUG}}' ) }
		</PluginSidebarMoreMenuItem>

		<PluginSidebar
			name={ SIDEBAR_NAME }
			title={ __( '{{PLUGIN_NAME}}', '{{PLUGIN_SLUG}}' ) }
			icon="admin-generic"
		>
			<PanelBody title={ __( 'Overview', '{{PLUGIN_SLUG}}' ) } initialOpen>
				<PanelRow>
					{ __( 'Replace this with your module UI.', '{{PLUGIN_SLUG}}' ) }
				</PanelRow>
			</PanelBody>
		</PluginSidebar>
	</>
);

registerPlugin( SIDEBAR_NAME, { render: Sidebar, icon: 'admin-generic' } );
