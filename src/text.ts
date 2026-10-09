// Text helpers for the renderer: reading the text of an item, detecting the direction of the texts,
// and deciding whether a link href is safe to render. Leaf module, no DOM writes.
import type { TextItem } from './options';

// First strong character decides: skip anything that is not a letter (digits, including Arabic-Indic, are weak).
const RTL_FIRST_STRONG = /^\P{L}*(?=\p{L})[\p{sc=Arab}\p{sc=Hebr}\p{sc=Syrc}\p{sc=Thaa}\p{sc=Nkoo}]/u;

// Only these schemes can become a link. Anything else (javascript:, data:, ...) is shown as plain text.
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/** The text an item displays, whether it is a plain string or a link object. */
export function textOf(item: TextItem): string {
  return typeof item === 'string' ? item : item.text;
}

/**
 * True when the texts should scroll right to left, decided by the first letter across the texts, in order.
 * Texts with no letters (digits, emoji, punctuation) are skipped, so "2024 مرحبا" is RTL.
 */
export function isRtl(texts: string[]): boolean {
  return RTL_FIRST_STRONG.test(texts.join(' '));
}

/**
 * Returns the absolute URL to use as an anchor href, or '' when the item must render as plain text.
 * Empty and whitespace-only hrefs are not links. Relative hrefs resolve against the page's base URI.
 */
export function safeHref(href: string): string {
  if (!href.trim()) return '';
  try {
    const url = new URL(href, document.baseURI);
    return SAFE_PROTOCOLS.includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
