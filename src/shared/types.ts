export type StoredRule = {
  cardId: string;
  cardName: string;
  createdAt: string;
  frameScope: string | null;
  selector: string;
};

export type ProfileCard = {
  createdAt: string;
  enabled: boolean;
  id: string;
  name: string;
  updatedAt: string;
};

export type SavedCard = {
  cardId: string;
  cardName: string;
  createdAt: string;
  enabled: boolean;
  frameScopes: (string | null)[];
  ruleCount: number;
  rules: StoredRule[];
};

export type RuleProfile = {
  cards: ProfileCard[];
  enabled: boolean;
  id: string;
  matchers: string[];
  name: string;
  rules: StoredRule[];
  updatedAt: string;
};

export type RuleStore = {
  version: 4;
  settings: {
    globalEnabled: boolean;
  };
  profiles: RuleProfile[];
};

export type ActiveSiteState = {
  activeProfileId: string | null;
  activeProfileName: string | null;
  cardCount: number;
  cards: SavedCard[];
  enabledSelectorCount: number;
  globalEnabled: boolean;
  hostname: string;
  matchers: string[];
  profileEnabled: boolean;
  rules: StoredRule[];
  selectorCount: number;
  updatedAt: string;
  url: string;
};
