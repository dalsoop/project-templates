const STABLE_ATTRIBUTES = ["data-testid", "data-test", "data-qa", "name", "role", "aria-label"] as const;

function escapeSelector(value: string): string {
  return CSS.escape(value);
}

function isUniqueSelector(selector: string, root: Document = document): boolean {
  return root.querySelectorAll(selector).length === 1;
}

function stableClasses(element: Element): string[] {
  return Array.from(element.classList)
    .filter((className) => /^[a-z][a-z0-9_-]{1,30}$/i.test(className))
    .slice(0, 3);
}

function attributeSelector(element: Element): string | null {
  for (const attribute of STABLE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value && value.length <= 80) {
      return `[${attribute}="${escapeSelector(value)}"]`;
    }
  }

  return null;
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

function simpleSelector(element: Element): string {
  const id = element.getAttribute("id");
  if (id) {
    const byId = `#${escapeSelector(id)}`;
    if (isUniqueSelector(byId)) {
      return byId;
    }
  }

  const attr = attributeSelector(element);
  if (attr) {
    const byAttr = `${element.localName}${attr}`;
    if (isUniqueSelector(byAttr)) {
      return byAttr;
    }
  }

  const classes = stableClasses(element);
  if (classes.length > 0) {
    const classSelector = `${element.localName}${classes.map((className) => `.${escapeSelector(className)}`).join("")}`;
    if (isUniqueSelector(classSelector)) {
      return classSelector;
    }
  }

  return nthOfTypeSelector(element);
}

export function buildSelector(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    segments.unshift(simpleSelector(current));
    const selector = segments.join(" > ");

    if (isUniqueSelector(selector)) {
      return selector;
    }

    current = current.parentElement;
  }

  return segments.join(" > ");
}

export function selectorCss(selectors: string[]): string {
  return selectors.map((selector) => `${selector} { display: none !important; }`).join("\n");
}
