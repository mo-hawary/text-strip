// Builds one strip's element tree inside an open shadow root, and writes option values onto it.
// createStrip makes the tree once. The paint functions set styles, labels and state, and renderCopies
// fills the two sets with text groups. The class names and attributes here are the DOM contract the tests use.
import { adoptStylesheet, createElement } from './dom';
import type { ResolvedOptions, TextItem } from './options';
import { isRtl, safeHref, textOf } from './text';

/** The elements of one strip. Everything except `host` lives inside the host's shadow root. */
export interface StripView {
  /** The <text-strip> host element that is inserted into the page. */
  host: HTMLElement;
  /** .sp, the spacer that reserves the strip's height in the page flow (fixed mode). */
  spacer: HTMLElement;
  /** .b, the visible bar. */
  bar: HTMLElement;
  /** .w, the clipped box that the moving text is seen through. */
  scroller: HTMLElement;
  /** .t, the moving track. It holds the two sets and is the element that animates. */
  track: HTMLElement;
  /** The first .s set: the readable copy of the texts. */
  firstSet: HTMLElement;
  /** The second .s set: an aria-hidden copy that makes the loop seamless. */
  secondSet: HTMLElement;
  /** .k, the group of buttons beside the scroller. */
  controls: HTMLElement;
  /** .y, the pause and play button. */
  pauseButton: HTMLButtonElement;
  /** .x, the close button. */
  closeButton: HTMLButtonElement;
}

/**
 * Creates the host, its open shadow root with the stylesheet, and every element of the strip.
 * The strip is not in the page yet: mountStrip (mount.ts) inserts the host.
 */
export function createStrip(): StripView {
  const host = document.createElement('text-strip');
  host.setAttribute('data-text-strip', '');
  host.setAttribute('role', 'region');
  const root = host.attachShadow({ mode: 'open' });
  adoptStylesheet(root);

  const spacer = createElement('div', 'sp', root);
  const bar = createElement('div', 'b', root);
  const scroller = createElement('div', 'w', bar);
  const track = createElement('div', 't', scroller);
  const firstSet = createElement('div', 's', track);
  // The second set is the copy that makes the loop seamless, so assistive technology skips it.
  const secondSet = createElement('div', 's', track);
  secondSet.setAttribute('aria-hidden', 'true');
  const controls = createElement('div', 'k', bar);
  const pauseButton = createElement('button', 'y', controls);
  pauseButton.type = 'button';
  const closeButton = createElement('button', 'x', controls, '×');
  closeButton.type = 'button';

  return { host, spacer, bar, scroller, track, firstSet, secondSet, controls, pauseButton, closeButton };
}

/** Padding that gives each item half of the gap on each side. */
function padItem(element: HTMLElement, options: ResolvedOptions): HTMLElement {
  element.style.padding = `0 ${options.gap / 2}px`;
  return element;
}

/**
 * Builds one group: every item, each followed by its separator.
 * Hidden groups are the repeats and the second set, so they are aria-hidden. Links inside them get
 * tabIndex -1, so keyboard users reach each link once, in the readable copy.
 */
function buildGroup(options: ResolvedOptions, hidden: boolean): HTMLElement {
  const group = createElement('span', 'g');
  if (hidden) group.setAttribute('aria-hidden', 'true');
  options.textArray.forEach((item: TextItem) => {
    const href = typeof item === 'string' ? '' : safeHref(item.href);
    const element = createElement(href ? 'a' : 'span', 'i', group, textOf(item));
    if (href) {
      element.setAttribute('href', href);
      if (hidden) element.tabIndex = -1;
    }
    padItem(element, options);
    if (options.separator) {
      padItem(createElement('span', 'p', group, options.separator), options).setAttribute('aria-hidden', 'true');
    }
  });
  return group;
}

/**
 * Replaces the groups in both sets with `count` groups each.
 * Only the first group of the first set is readable. Every other group is a repeat or a copy and is aria-hidden.
 * `count` comes from the loop measurement (loop.ts): one group to measure, then enough to fill the bar.
 */
export function renderCopies(view: StripView, options: ResolvedOptions, count: number): void {
  const { firstSet, secondSet } = view;
  firstSet.textContent = secondSet.textContent = '';
  for (let index = 0; index < count; index++) {
    firstSet.appendChild(buildGroup(options, index > 0));
    secondSet.appendChild(buildGroup(options, true));
  }
}

/**
 * Writes the static look and behavior of the options onto the bar: colors, size, direction, classes
 * and the close button. Runs on every create and update. It does not touch the animation or the pause state.
 */
export function paintOptions(view: StripView, options: ResolvedOptions): void {
  const { host, bar, closeButton } = view;
  const style = bar.style;
  style.height = `${options.height}px`;
  style.background = options.stripBgColor;
  style.color = options.textColor;
  style.fontSize = options.fontSize;
  style.fontFamily = options.fontFamily;
  // Static strips stay in the flow, so they take no z-index.
  style.zIndex = options.stripMode === 'static' ? '' : String(options.zIndex);
  host.setAttribute('aria-label', options.ariaLabel);
  // 'auto' follows the first strong directional character of the texts.
  const rtl = options.dir === 'auto' ? isRtl(options.textArray.map(textOf)) : options.dir === 'rtl';
  bar.dir = rtl ? 'rtl' : 'ltr';
  const classes = bar.classList;
  classes.toggle('f', options.stripMode !== 'static');
  classes.toggle('ph', options.pauseOnHover);
  classes.toggle('rm', options.respectReducedMotion);
  closeButton.hidden = !options.closable;
  closeButton.setAttribute('aria-label', options.closeLabel);
}

/**
 * Shows the paused or playing state: the bar class, the button icon and the button's accessible name.
 * The icon is a play triangle while paused and two pause bars while playing.
 */
export function paintPaused(view: StripView, options: ResolvedOptions, paused: boolean): void {
  const { bar, pauseButton } = view;
  bar.classList.toggle('paused', paused);
  pauseButton.textContent = paused ? '▶' : '❚❚';
  pauseButton.setAttribute('aria-label', paused ? options.playLabel : options.pauseLabel);
}

/**
 * Makes the scroller reachable by Tab only when it is a scroll area (reduced motion with respectReducedMotion).
 * A scroll area needs keyboard focus so people can scroll it, so it gets tabindex 0. Otherwise it has no tab stop.
 */
export function paintScrollerFocus(view: StripView, focusable: boolean): void {
  const { scroller } = view;
  if (focusable) scroller.tabIndex = 0;
  else scroller.removeAttribute('tabindex');
}
