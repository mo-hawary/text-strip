// All sizing and colors are set inline on shadow elements, so no page-level custom property can reach in.
// !important inside the shadow tree beats even !important page rules aimed at the host.
export const styles =
  ':host{all:initial!important;display:block!important;font-family:inherit!important}' +
  ':host::before,:host::after{content:none!important;display:none!important}' +
  ':host([data-o]){display:contents!important}' +
  // The text scrolls inside .w; the buttons in .k are a flex sibling, so no scroll can move them.
  '.b{display:flex}' +
  '.w{flex:1;min-width:0;display:flex;overflow:hidden;overflow:clip}' +
  '.f{position:fixed;left:0;right:0}' +
  '.t{display:flex;align-self:stretch;align-items:center;flex-shrink:0;will-change:transform;animation:l 20s linear infinite}' +
  '[dir=rtl] .t{animation-name:r}' +
  '.s,.g{display:flex;flex-shrink:0;align-items:center}' +
  '.i,.p{white-space:nowrap;unicode-bidi:isolate}a{color:inherit;text-decoration:underline}' +
  '.ph .t:hover,.t:focus-within,.paused .t{animation-play-state:paused}' +
  '.k{display:flex;flex:none}' +
  '.x,.y{padding:0 .6em;border:0;background:inherit;color:inherit;font:inherit;font-size:1.2em;line-height:1;cursor:pointer}' +
  '.w:focus-visible,.x:focus-visible,.y:focus-visible{outline:2px solid currentColor;outline-offset:-2px}' +
  '.fit .t{animation:none;margin-inline:auto}.fit .s+.s{display:none}' +
  '@keyframes l{to{transform:translateX(-50%)}}@keyframes r{to{transform:translateX(50%)}}' +
  '@media (prefers-reduced-motion:reduce){.rm .t{animation:none}.rm .w{overflow-x:auto}.rm .s+.s,.rm .g+.g,.rm .y{display:none}}';
