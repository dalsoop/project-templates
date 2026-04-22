export type StoredRule = {
  createdAt: string;
  frameScope: string | null;
  selector: string;
};

export type RuleProfile = {
  enabled: boolean;
  id: string;
  matchers: string[];
  name: string;
  rules: StoredRule[];
  updatedAt: string;
};

export type RuleStore = {
  version: 3;
  settings: {
    globalEnabled: boolean;
  };
  profiles: RuleProfile[];
};

export type ActiveSiteState = {
  activeProfileId: string | null;
  activeProfileName: string | null;
  globalEnabled: boolean;
  hostname: string;
  matchers: string[];
  profileEnabled: boolean;
  rules: StoredRule[];
  selectorCount: number;
  updatedAt: string;
  url: string;
};
