// The orchestrator: createTextStrip resolves the options, applies the server and dismissal guards,
// builds the view, and wires the observers, listeners and the instance API together.
// It holds the instance state and decides when to repaint, mount and measure. The work itself lives in
// options.ts, render.ts, loop.ts, mount.ts, registry.ts and storage.ts.
import { resolveOptions } from './options';
import type { ResolvedOptions, TextStripOptions } from './options';
import { createStrip, paintOptions, paintPaused, paintScrollerFocus } from './render';
import { measureLoop, readProgress } from './loop';
import type { LoopState } from './loop';
import { mountStrip } from './mount';
import type { Slot } from './mount';
import { registerStrip, relayout, unregisterStrip } from './registry';
import type { RegistryEntry } from './registry';
import { isDismissed, rememberDismissal } from './storage';

/** The object returned by createTextStrip. */
export interface TextStrip {
  /** The host element, or null when the strip was not created (no document, or a stored dismissal). */
  element: HTMLElement | null;
  /** Changes options and re-renders. The loop keeps its progress. Does nothing after destroy(). */
  update(patch: Partial<TextStripOptions>): void;
  /** Pauses the scrolling and shows the play state. */
  pause(): void;
  /** Resumes the scrolling and shows the pause state. */
  play(): void;
  /**
   * Removes the strip and its spacer from the page, and stops its observers and media listener.
   * The DOMContentLoaded and fonts.ready callbacks stay attached but do nothing once destroyed.
   * Does nothing when already destroyed.
   */
  destroy(): void;
}

/** Media query for the reduced-motion preference. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The instance returned when nothing is created. Every method is a no-op, and element is null. */
function inertInstance(): TextStrip {
  return {
    element: null,
    update() {},
    pause() {},
    play() {},
    destroy() {},
  };
}

/** The localStorage key for remembered dismissals, or '' when rememberDismiss is off. */
function dismissKeyOf(options: ResolvedOptions): string {
  return typeof options.rememberDismiss === 'string' ? options.rememberDismiss : '';
}

/**
 * Creates one announcement strip and returns its instance.
 * Throws on invalid options, even when there is no document, so a server render reports a bad config too.
 * Returns an inert instance (element null) when there is no document or the visitor dismissed this strip before.
 * Side effects: inserts the host into the page and registers the strip for stacking.
 */
export function createTextStrip(options: TextStripOptions): TextStrip {
  const initial = resolveOptions(options);
  if (typeof document === 'undefined') return inertInstance();
  const storageKey = dismissKeyOf(initial);
  if (storageKey && isDismissed(storageKey)) return inertInstance();

  const view = createStrip();
  // Instance state that changes over the strip's life. Plain closure variables, shared by the functions below.
  /** Current options, replaced on every update. */
  let current: ResolvedOptions = initial;
  /** False after destroy(). Every entry point checks it. */
  let alive = true;
  /** True while the loop is paused by the visitor or the integrator. */
  let paused = false;
  /** Where the host was last placed, so an unchanged placement skips the insert. */
  let slot: Slot | undefined;
  /** True while a measurement is queued for the next animation frame. */
  let queued = false;
  /** Measured widths and the lap duration. */
  const loop: LoopState = { barWidth: -1, groupWidth: -1, duration: 20000 };
  // The shared registry entry. Its options are kept in step with `current` on every apply().
  const entry: RegistryEntry = { o: initial, b: view.bar };
  registerStrip(entry);
  const reducedMotion = typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION_QUERY) : null;

  // The default progress is read before the alive check. readProgress only reads, so this is harmless after destroy().
  /**
   * Re-measures the loop now. `at` is the progress to keep, defaulting to the current progress.
   * Does nothing after destroy().
   */
  const measure = (force: boolean, at = readProgress(view, loop)) => {
    if (alive) measureLoop(view, current, loop, force, at);
  };

  /** Queues one measurement for the next frame. Several calls before that frame cost one measurement. */
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      measure(false);
    });
  };

  /** Puts the scroller in the tab order only when it is a scroll area (reduced motion). */
  const paintFocus = () => {
    paintScrollerFocus(view, current.respectReducedMotion && !!reducedMotion?.matches);
  };

  /**
   * Places the host for the current options (see mountStrip), then relayouts the stack.
   * Does nothing once destroyed or before <body> exists, and then does not relayout either.
   */
  const mount = () => {
    const body = document.body;
    if (alive && body) {
      slot = mountStrip(view, current, slot, body);
      relayout();
    }
  };

  /** Writes the current options onto the strip. Runs on create and on every update. */
  const apply = () => {
    entry.o = current;
    paintOptions(view, current);
    paintPaused(view, current, paused);
    paintFocus();
    mount();
  };

  const setPaused = (value: boolean) => {
    paused = value;
    paintPaused(view, current, value);
  };

  // Reduced motion changes the repeats and the tab stop, so both are re-checked, and the loop is re-measured.
  const onReducedMotionChange = () => {
    paintFocus();
    loop.barWidth = -1;
    schedule();
  };

  apply();
  measure(true);

  // A script in <head> runs before <body> exists. The strip waits for DOMContentLoaded, then mounts itself.
  if (!document.body) {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        mount();
        measure(true);
      },
      { once: true },
    );
  }

  // ResizeObserver ships in every evergreen browser since 2020; the guard only protects other runtimes.
  // The track is observed too, so typography changes re-measure.
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : undefined;
  resizeObserver?.observe(view.bar);
  resizeObserver?.observe(view.track);
  reducedMotion?.addEventListener?.('change', onReducedMotionChange);
  // Font loading changes text widths without resizing the strip, so force a re-measure.
  document.fonts?.ready.then(() => {
    loop.barWidth = -1;
    schedule();
  });

  const instance: TextStrip = {
    element: view.host,
    update(patch) {
      if (!alive) return;
      // Read the progress before apply(): a direction change swaps the animation object.
      const at = readProgress(view, loop);
      current = resolveOptions(patch, current);
      apply();
      measure(true, at);
    },
    pause: () => setPaused(true),
    play: () => setPaused(false),
    destroy() {
      if (!alive) return;
      alive = false;
      resizeObserver?.disconnect();
      reducedMotion?.removeEventListener?.('change', onReducedMotionChange);
      view.host.remove();
      unregisterStrip(entry);
      relayout();
    },
  };

  view.pauseButton.addEventListener('click', () => (paused ? instance.play() : instance.pause()));

  view.closeButton.addEventListener('click', () => {
    const key = dismissKeyOf(current);
    if (key) rememberDismissal(key);
    instance.destroy();
    current.onClose?.();
  });

  return instance;
}
