// The scroll loop's numbers: how wide one group is, how many copies fill the bar, how long one lap takes,
// and where in the lap the animation is. Measuring writes the repeat count and duration back to the DOM.
// It uses render.ts to rebuild the copies, and only strip.ts imports it.
import { renderCopies } from './render';
import type { StripView } from './render';
import type { ResolvedOptions } from './options';

/** What the loop remembers between measurements. */
export interface LoopState {
  /** Bar width at the last measurement, or -1 while the strip has no size (hidden or detached). */
  barWidth: number;
  /** Width of one group at the last measurement. */
  groupWidth: number;
  /** Length of one lap in milliseconds. */
  duration: number;
}

/**
 * The lap animation of the track, or undefined when the browser has none (for example before the first style).
 * getAnimations is optional because older browsers lack it.
 */
function lapAnimation(track: HTMLElement): Animation | undefined {
  return track.getAnimations?.()[0];
}

/**
 * Reads how far the loop has run, as a fraction from 0 to 1 of one lap, or undefined when the track has no animation.
 * Why a fraction: a direction change replaces the animation object, and a resize or an update changes the lap
 * duration. The same currentTime would land at a different point of the lap, so the position is kept as a fraction.
 * The caller reads the fraction first, then measureLoop writes it back onto the new animation, so the text does not jump back to the start.
 */
export function readProgress(view: StripView, loop: LoopState): number | undefined {
  const animation = lapAnimation(view.track);
  return animation ? ((Number(animation.currentTime) || 0) / loop.duration) % 1 : undefined;
}

/**
 * Measures the strip and sets the repeat count, the lap duration and the animation position.
 * Skips the work when the bar and the group width are unchanged, unless `force` is set.
 * Side effects: rebuilds the copies only when needed, sets the pause button, the fit class, the duration and the animation time.
 * `progressAt` is the fraction read by readProgress before the change (0 when there was none).
 */
export function measureLoop(
  view: StripView,
  options: ResolvedOptions,
  loop: LoopState,
  force: boolean,
  progressAt: number | undefined,
): void {
  const { bar, firstSet, track, controls, pauseButton } = view;
  const barWidth = bar.clientWidth;
  const currentGroupWidth = firstSet.firstElementChild?.getBoundingClientRect().width;
  // Same bar and group size as the last measurement: nothing has changed, so skip the rebuild.
  if (barWidth && !force && barWidth === loop.barWidth && currentGroupWidth === loop.groupWidth) return;

  // Rebuild only when the content may have changed (`force`, used by update) or nothing is rendered yet.
  // Rebuilding replaces the elements, which would drop keyboard focus from a link inside the strip,
  // so a resize or a font load measures the group that is already on screen.
  if (force || !firstSet.firstElementChild) renderCopies(view, options, 1);
  const groupWidth = (firstSet.firstElementChild as HTMLElement).getBoundingClientRect().width;
  // Hidden or detached: keep one group and measure again once the strip has a real size.
  loop.barWidth = barWidth && groupWidth ? barWidth : -1;
  loop.groupWidth = groupWidth;
  if (loop.barWidth < 0) return;

  // A group that fits is shown alone and still, so the pause button (only for motion) is hidden.
  // The controls width is subtracted from the bar and the pause button width is added back, because the pause button
  // is hidden when the text fits, so its space is not needed. The text never runs under the controls.
  const fits = groupWidth <= barWidth - controls.offsetWidth + pauseButton.offsetWidth;
  pauseButton.hidden = fits || !options.pauseButton;
  bar.classList.toggle('fit', fits);

  // Groups needed to cover the bar: ceil(bar width / group width). A fitting text shows a single group.
  const copies = Math.ceil(barWidth / groupWidth);
  const rendered = fits ? 1 : copies;
  if (firstSet.childElementCount !== rendered) renderCopies(view, options, rendered);
  // The lap is the width of all rendered copies at the text speed. The count matches what is rendered,
  // so hidden repeats under reduced motion do not change the duration of the visible lap.
  loop.duration = ((copies * groupWidth) / options.textSpeed) * 1e3;
  track.style.animationDuration = `${loop.duration}ms`;

  // Put the animation back at the progress read before the change, so the text does not jump.
  const animation = lapAnimation(track);
  if (animation) animation.currentTime = (progressAt || 0) * loop.duration;
}
