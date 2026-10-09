// Decides where the strip's host goes in the target, inserts it, and keeps the spacer and overlay flag in step.
// Placement rules: a fixed top strip goes before the first static strip, a static top strip goes after the
// leading run of <text-strip> elements at the start of the target, and bottom or overlay strips are appended last.
// This module does not stack strips; the caller runs relayout() after mountStrip (see strip.ts).
import type { ResolvedOptions } from './options';
import type { StripView } from './render';

/**
 * Where a strip goes in its target:
 * - 'fixed-top': a fixed strip at the top, placed before the first static strip so it never covers one.
 * - 'static-top': a static strip at the top, placed after the leading run of strips at the start of the target.
 * - 'last': a bottom strip (fixed or static) or an overlay, appended as the last child.
 */
export type Slot = 'fixed-top' | 'static-top' | 'last';

/** The slot an option set maps to. Static bottom strips use 'last', the same as fixed bottom strips. */
export function slotOf(options: ResolvedOptions): Slot {
  if (options.stripMode === 'overlay' || options.stripPosition === 'bottom') return 'last';
  return options.stripMode === 'static' ? 'static-top' : 'fixed-top';
}

/**
 * The element that receives the host: the body for overlay mode, otherwise `mountTarget`.
 * A string is a CSS selector. When it matches nothing, or no target is set, the body is used.
 */
function targetOf(options: ResolvedOptions, body: HTMLElement): Element {
  if (options.stripMode === 'overlay') return body;
  const mountTarget = options.mountTarget;
  const found = typeof mountTarget === 'string' ? document.querySelector(mountTarget) : mountTarget;
  return found || body;
}

/**
 * The child the host should be inserted before, or null to append.
 * Walks past the other strips that belong before this one, and stops at the first element that does not.
 * The walk never goes past the host itself, so an already placed host stays where it is.
 */
function insertionPoint(host: HTMLElement, target: Element, slot: Slot): Element | null {
  if (slot === 'last') return null;
  let reference = target.firstElementChild;
  while (
    reference &&
    reference !== host &&
    reference.localName === 'text-strip' &&
    (slot === 'static-top' || !reference.hasAttribute('data-s'))
  ) {
    reference = reference.nextElementSibling;
  }
  return reference;
}

/**
 * Places the host for the current options. It does not relayout the stack; the caller does that.
 * Why the insert is skipped when unchanged: moving a connected element drops focus inside it,
 * so the host is only moved when its target or its slot changed. `previous` is the slot from the last call.
 * Returns the slot to pass back as `previous` next time.
 * Side effects: sets data-o and data-s on the host, the spacer's hidden flag and height, and inserts the host.
 */
export function mountStrip(view: StripView, options: ResolvedOptions, previous: Slot | undefined, body: HTMLElement): Slot {
  const { host, spacer } = view;
  const target = targetOf(options, body);
  const slot = slotOf(options);
  // Overlay strips are marked so CSS can give them display: contents (no box of their own).
  host.toggleAttribute('data-o', options.stripMode === 'overlay');
  // The spacer only reserves space in fixed mode.
  spacer.hidden = options.stripMode !== 'fixed';
  spacer.style.height = `${options.height}px`;
  host.toggleAttribute('data-s', slot === 'static-top');
  if (host.parentNode !== target || previous !== slot) {
    target.insertBefore(host, insertionPoint(host, target, slot));
  }
  return slot;
}
