export type SiteRuleSet = {
  enabled: boolean;
  selectors: string[];
  updatedAt: string;
};

export type RuleStore = {
  version: 2;
  settings: {
    globalEnabled: boolean;
  };
  sites: Record<string, SiteRuleSet>;
};

export type ActiveSiteState = {
  globalEnabled: boolean;
  hostname: string;
  selectors: string[];
  selectorCount: number;
  siteEnabled: boolean;
  updatedAt: string;
};
