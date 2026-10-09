// All sizing and colors are set inline on shadow elements, so no page-level custom property can reach in.
// !important inside the shadow tree beats even !important page rules aimed at the host.
export const styles =
  ':host{all:initial!important;display:block!important;font-family:inherit!important}' +
  ':host([data-o]){display:contents!important}' +
  '.b{position:relative;display:flex;align-items:center;overflow:hidden}' +
  '.f{position:fixed;left:0;right:0}' +
  '.c{padding-inline-end:2.4em}' +
  '.t{display:flex;flex-shrink:0;will-change:transform;animation:l 20s linear infinite}' +
  '[dir=rtl] .t{animation-name:r}' +
  '.s,.g{display:flex;align-items:center;flex-shrink:0}' +
  '.i,.p{white-space:nowrap;unicode-bidi:isolate;padding:0 calc(var(--g)/2)}' +
  '.ph:hover .t,.ph:focus-within .t,.paused .t{animation-play-state:paused}' +
  '.x{position:absolute;inset-inline-end:0;inset-block:0;padding:0 .6em;border:0;background:inherit;color:inherit;font:inherit;font-size:1.2em;line-height:1;cursor:pointer}' +
  '.x:focus-visible,.b:focus-visible{outline:2px solid currentColor;outline-offset:-2px}' +
  '@keyframes l{to{transform:translateX(-50%)}}' +
  '@keyframes r{to{transform:translateX(50%)}}' +
  '@media (prefers-reduced-motion:reduce){.rm .t{animation:none}.rm{overflow-x:auto}.rm .s+.s,.rm .g+.g{display:none}}';
