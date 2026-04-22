export const messageTypes = {
  getPageState: "infocutter/get-page-state",
  startPicker: "infocutter/start-picker",
  clearSiteRules: "infocutter/clear-site-rules"
} as const;

export type MessageType = (typeof messageTypes)[keyof typeof messageTypes];
