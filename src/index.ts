// Public entry point. Re-exports the factory, its `create` alias, the defaults and the public types.
// Nothing else in src/ is part of the public API.
export { createTextStrip, createTextStrip as create } from './strip';
export type { TextStrip } from './strip';
export type { TextStripOptions, TextItem, StripPosition, StripMode, TextDir } from './options';
export { DEFAULTS } from './options';
