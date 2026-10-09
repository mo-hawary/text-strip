// Shared registry of live strips, used to stack fixed and overlay strips and to publish --text-strip-height.
// It lives on globalThis under Symbol.for('text-strip'), so two copies of the library on one page
// (for example the CDN build and the npm package) see the same strips.
// The field names are short on purpose: other copies read these same objects, so do not rename them.
import type { ResolvedOptions } from './options';

/** One live strip, as every copy of the library sees it. */
export interface RegistryEntry {
  /** Current options of the strip. */
  o: ResolvedOptions;
  /** The visible bar, whose box is stacked. */
  b: HTMLElement;
}

interface Registry {
  /** Live strips, in creation order. */
  l: RegistryEntry[];
  /** True while some strip has set --text-strip-height. */
  e?: boolean;
}

const registry: Registry = (globalThis as any)[Symbol.for('text-strip')] ||= { l: [] };
const live = registry.l;

/**
 * Adds a strip to the stack. Call it before the first mount, so the strip is part of the first relayout.
 */
export function registerStrip(entry: RegistryEntry): void {
  live.push(entry);
}

/**
 * Removes a strip from the stack. The caller runs relayout() afterwards so the others close the gap.
 */
export function unregisterStrip(entry: RegistryEntry): void {
  live.splice(live.indexOf(entry), 1);
}

/**
 * Stacks the fixed and overlay strips on each side, and keeps --text-strip-height in sync.
 * Each strip goes after the ones before it on the same side, in creation order. Static strips are not stacked.
 * Side effects: writes top or bottom on each connected bar, and sets or removes the root variable.
 */
export function relayout(): void {
  // Running offset per side: the next strip on that side starts this far from the edge.
  const offsets: Record<'top' | 'bottom', number> = { top: 0, bottom: 0 };
  let exposeHeight = false;
  live.forEach(({ o: options, b: bar }) => {
    // A detached bar is not on the page, so it takes no place in the stack.
    if (!bar.isConnected) return;
    bar.style.top = bar.style.bottom = '';
    if (options.stripMode !== 'static') {
      bar.style[options.stripPosition] = `${offsets[options.stripPosition]}px`;
      offsets[options.stripPosition] += options.height;
    }
    exposeHeight = exposeHeight || options.exposeHeightVar;
  });
  const rootStyle = document.documentElement.style;
  // The variable is the total height of the top strips, so content can sit below a stack of them.
  if (exposeHeight) rootStyle.setProperty('--text-strip-height', `${offsets.top}px`);
  else if (registry.e) rootStyle.removeProperty('--text-strip-height');
  registry.e = exposeHeight;
}
