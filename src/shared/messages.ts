export const messageTypes = {
  getPageState: "infocutter/get-page-state",
  startPicker: "infocutter/start-picker",
  clearSiteRules: "infocutter/clear-site-rules",
  removeSiteRule: "infocutter/remove-site-rule",
  toggleSiteEnabled: "infocutter/toggle-site-enabled",
  toggleGlobalEnabled: "infocutter/toggle-global-enabled"
} as const;

export type MessageType = (typeof messageTypes)[keyof typeof messageTypes];
