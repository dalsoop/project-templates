const STABLE_ATTRIBUTES = ["data-testid", "data-test", "data-qa", "aria-label", "title", "alt"] as const;
const MAX_SELECTOR_DEPTH = 4;

function escapeSelector(value: string): string {
  return CSS.escape(value);
}

function isUniqueSelector(selector: string, root: Document = document): boolean {
  return root.querySelectorAll(selector).length === 1;
}

function maybeStableClassName(className: string): boolean {
  if (!/^[a-z][a-z0-9_-]{1,40}$/i.test(className)) {
    return false;
  }

  const digitCount = className.replace(/\D/g, "").length;
  return digitCount <= 3;
}

function stableClasses(element: Element): string[] {
  return Array.from(element.classList).filter(maybeStableClassName).slice(0, 3);
}

function attributeSelectors(element: Element): string[] {
  const selectors: string[] = [];

  for (const attribute of STABLE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value && value.length <= 80) {
      selectors.push(`${element.localName}[${attribute}="${escapeSelector(value)}"]`);
      selectors.push(`[${attribute}="${escapeSelector(value)}"]`);
    }
  }

  return selectors;
}

function classSelectors(element: Element): string[] {
  const classes = stableClasses(element);
  const selectors: string[] = [];

  for (let size = 1; size <= classes.length; size += 1) {
    const joined = classes.slice(0, size).map((className) => `.${escapeSelector(className)}`).join("");
    selectors.push(`${element.localName}${joined}`);
    selectors.push(joined);
  }

  return selectors;
}

function nthOfTypeSelector(element: Element): string {
  const parent = element.parentElement;
  if (!parent) {
    return element.localName;
  }

  const siblings = Array.from(parent.children).filter((child) => child.localName === element.localName);
  const index = siblings.indexOf(element) + 1;
  return `${element.localName}:nth-of-type(${index})`;
}

function isBareTagSelector(selector: string): boolean {
  return /^[a-z][a-z0-9-]*$/i.test(selector);
}

function selectorSpecificityScore(selector: string): number {
  let score = 0;
  if (selector.includes("#")) {
    score += 6;
  }
  if (selector.includes("[")) {
    score += 4;
  }
  if (selector.includes(".")) {
    score += 3;
  }
  if (selector.includes(":nth-of-type")) {
    score -= 2;
  }
  if (selector.includes(">")) {
    score += 2;
  }
  if (isBareTagSelector(selector)) {
    score -= 6;
  }
  return score;
}

function simpleCandidates(element: Element, options?: { allowNth?: boolean }): string[] {
  const selectors: string[] = [];
  const id = element.getAttribute("id");

  if (id) {
    selectors.push(`#${escapeSelector(id)}`);
    selectors.push(`${element.localName}#${escapeSelector(id)}`);
  }

  selectors.push(...attributeSelectors(element));
  selectors.push(...classSelectors(element));
  selectors.push(element.localName);

  if (options?.allowNth) {
    selectors.push(nthOfTypeSelector(element));
  }

  return Array.from(new Set(selectors));
}

function uniqueDirectCandidates(element: Element, root: Document = document): string[] {
  return simpleCandidates(element, { allowNth: true }).filter((selector) => isUniqueSelector(selector, root));
}

function pathSelector(ancestor: Element, target: Element): string {
  const segments: string[] = [];
  let current: Element | null = target;

  while (current && current !== ancestor) {
    const candidates = simpleCandidates(current, { allowNth: true });
    segments.unshift(candidates[0] ?? current.localName);
    current = current.parentElement;
  }

  const anchorCandidates = uniqueDirectCandidates(ancestor);
  const anchor = anchorCandidates[0] ?? ancestor.localName;

  return [anchor, ...segments].join(" > ");
}

export function buildSelectorCandidates(element: Element, root: Document = document): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const pushIfUseful = (selector: string): void => {
    if (!selector || seen.has(selector)) {
      return;
    }

    seen.add(selector);
    results.push(selector);
  };

  const directCandidates = uniqueDirectCandidates(element, root).sort(
    (left, right) => selectorSpecificityScore(right) - selectorSpecificityScore(left)
  );

  for (const selector of directCandidates) {
    pushIfUseful(selector);
  }

  let ancestor = element.parentElement;
  let depth = 0;

  while (ancestor && depth < MAX_SELECTOR_DEPTH) {
    const anchored = pathSelector(ancestor, element);
    pushIfUseful(anchored);
    if (isUniqueSelector(anchored, root)) {
      break;
    }

    ancestor = ancestor.parentElement;
    depth += 1;
  }

  if (results.length === 0) {
    pushIfUseful(nthOfTypeSelector(element));
  }

  return results;
}

export function buildSelector(element: Element): string {
  return buildSelectorCandidates(element)[0] ?? element.localName;
}

export function selectorCss(selectors: string[]): string {
  return selectors.map((selector) => `${selector} { display: none !important; }`).join("\n");
}
