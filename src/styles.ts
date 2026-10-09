// The strip's stylesheet as one CSS string. It is adopted into the shadow root (see dom.ts).
// The rules are grouped by job and kept in their original order, because the cascade depends on order.

// Host isolation: the page cannot style the host, and the host cannot inherit page styles, except font-family,
// which is inherited on purpose. All sizing and colors are set inline on shadow elements, so no page-level custom property can reach in.
// !important inside the shadow tree beats even !important page rules aimed at the host.
export const styles =
  ':host{all:initial!important;display:block!important;font-family:inherit!important}' +
  ':host::before,:host::after{content:none!important;display:none!important}' +
  // Overlay strips have no box of their own, so body grid and flex layouts are not affected.
  ':host([data-o]){display:contents!important}' +
  // Layout: the bar is a flex row, the scroller takes the free width, and fixed mode pins the bar to the viewport.
  // overflow:clip keeps the scroller from becoming a scroll container, so focusing a link cannot scroll the box
  // and fight the loop. overflow:hidden is the fallback for browsers without clip.
  '.b{display:flex}' +
  '.w{flex:1;min-width:0;display:flex;overflow:hidden;overflow:clip}' +
  '.f{position:fixed;left:0;right:0}' +
  // Track and animation: the track holds two identical sets and moves by half its width, then restarts.
  // In RTL the same loop runs the other way (keyframes r).
  '.t{display:flex;align-self:stretch;align-items:center;flex-shrink:0;will-change:transform;animation:l 20s linear infinite}' +
  '[dir=rtl] .t{animation-name:r}' +
  '.s,.g{display:flex;flex-shrink:0;align-items:center}' +
  // Text items: never wrap, and isolate each item for bidi so mixed-direction items keep their word order.
  '.i,.p{white-space:nowrap;unicode-bidi:isolate}a{color:inherit;text-decoration:underline}' +
  // Pause rules: hover (when pauseOnHover), keyboard focus inside the moving text, and the paused state.
  '.ph .t:hover,.t:focus-within,.paused .t{animation-play-state:paused}' +
  // Buttons: the controls group sits beside the scroller, so scrolling the text never moves them.
  '.k{display:flex;flex:none}' +
  '.x,.y{padding:0 .6em;border:0;background:inherit;color:inherit;font:inherit;font-size:1.2em;line-height:1;cursor:pointer}' +
  // Focus rings: a visible outline for keyboard users on the scroller and both buttons.
  '.w:focus-visible,.x:focus-visible,.y:focus-visible{outline:2px solid currentColor;outline-offset:-2px}' +
  // Fit mode: when one copy fits inside the bar, the text is centered and still, and the extra copies are hidden.
  '.fit .t{animation:none;margin-inline:auto}.fit .s+.s{display:none}' +
  // Keyframes: move the track left (LTR) or right (RTL) by half its width, which equals one full set.
  '@keyframes l{to{transform:translateX(-50%)}}@keyframes r{to{transform:translateX(50%)}}' +
  // Reduced motion: no animation, the strip becomes a horizontal scroll area, and repeats and the pause button are hidden.
  '@media (prefers-reduced-motion:reduce){.rm .t{animation:none}.rm .w{overflow-x:auto}.rm .s+.s,.rm .g+.g,.rm .y{display:none}}';
