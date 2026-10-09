// Small DOM helpers used by the renderer: element creation and stylesheet adoption into a shadow root.
// Nothing here knows about the strip's state, so each helper can be read on its own.

import { styles } from './styles';

/**
 * Creates an element with a class and optional text, and appends it to `parent` when one is given.
 * Text is set with textContent, never innerHTML, so option text is always plain text.
 * An empty `text` leaves the element without content.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: Node,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  parent?.appendChild(element);
  return element;
}

// One constructable sheet is built on first use and shared by every strip on the page.
let sharedSheet: CSSStyleSheet | undefined;

/**
 * Applies the strip's stylesheet (see styles.ts) to a shadow root.
 * Preferred path: a constructable stylesheet, which browsers accept under a strict style-src CSP.
 * Fallback for browsers without constructable sheets (Safari before 16.4): an inline <style> element.
 * Side effects: sets root.adoptedStyleSheets, or appends a <style> child to the root.
 */
export function adoptStylesheet(root: ShadowRoot): void {
  try {
    if (!sharedSheet) {
      sharedSheet = new CSSStyleSheet();
      sharedSheet.replaceSync(styles);
    }
    root.adoptedStyleSheets = [sharedSheet];
  } catch {
    createElement('style', '', root, styles);
  }
}
