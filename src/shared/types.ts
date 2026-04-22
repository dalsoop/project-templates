export type StoredRule = {
  createdAt: string;
  frameScope: string | null;
  selector: string;
};

export type SiteRuleSet = {
  enabled: boolean;
  rules: StoredRule[];
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
  rules: StoredRule[];
  selectorCount: number;
  siteEnabled: boolean;
  updatedAt: string;
};
