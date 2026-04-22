export type SiteRuleSet = {
  selectors: string[];
  updatedAt: string;
};

export type RuleStore = {
  version: 1;
  sites: Record<string, SiteRuleSet>;
};

export type ActiveSiteState = {
  hostname: string;
  selectorCount: number;
};
