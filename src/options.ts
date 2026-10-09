export type StripPosition = 'top' | 'bottom';
export type StripMode = 'fixed' | 'overlay' | 'static';
export type TextDir = 'ltr' | 'rtl' | 'auto';
export type TextItem = string | { text: string; href: string };

export interface TextStripOptions {
  textArray: TextItem[];
  stripBgColor?: string;
  textColor?: string;
  textSpeed?: number;
  stripPosition?: StripPosition;
  stripMode?: StripMode;
  mountTarget?: Element | string | null;
  dir?: TextDir;
  separator?: string;
  gap?: number;
  height?: number;
  fontSize?: string;
  fontFamily?: string;
  pauseOnHover?: boolean;
  respectReducedMotion?: boolean;
  closable?: boolean;
  rememberDismiss?: false | string;
  closeLabel?: string;
  pauseButton?: boolean;
  pauseLabel?: string;
  playLabel?: string;
  exposeHeightVar?: boolean;
  zIndex?: number;
  ariaLabel?: string;
  onClose?: () => void;
}

export type ResolvedOptions = Required<Omit<TextStripOptions, 'onClose'>> &
  Pick<TextStripOptions, 'onClose'>;

export const DEFAULTS: Readonly<Omit<ResolvedOptions, 'textArray'>> = Object.freeze({
  stripBgColor: '#111111',
  textColor: '#ffffff',
  textSpeed: 60,
  stripPosition: 'top',
  stripMode: 'fixed',
  mountTarget: null,
  dir: 'auto',
  separator: '•',
  gap: 32,
  height: 40,
  fontSize: '14px',
  fontFamily: 'inherit',
  pauseOnHover: true,
  respectReducedMotion: true,
  closable: false,
  rememberDismiss: false,
  closeLabel: 'Close',
  pauseButton: true,
  pauseLabel: 'Pause',
  playLabel: 'Play',
  exposeHeightVar: false,
  zIndex: 9999,
  ariaLabel: 'Announcements',
});

const item = (x: TextItem) =>
  typeof x === 'string'
    ? x.trim() !== ''
    : !!x && typeof x.text === 'string' && x.text.trim() !== '' && typeof x.href === 'string';

// Short messages keep the CDN bundle under its size budget; README documents each option.
// Options passed as undefined keep the value from base (the defaults, or the current options on update).
export function resolveOptions(input: Partial<TextStripOptions>, base: object = DEFAULTS): ResolvedOptions {
  const defined = Object.fromEntries(Object.entries(input || {}).filter(([, v]) => v !== undefined));
  const o = { ...base, ...defined } as ResolvedOptions;
  const t = o.mountTarget;
  const bad: [string, boolean][] = [
    ['textArray', !Array.isArray(o.textArray) || !o.textArray.length || !o.textArray.every(item)],
    ['textSpeed', !(Number.isFinite(o.textSpeed) && o.textSpeed > 0)],
    ['height', !(Number.isFinite(o.height) && o.height > 0)],
    ['gap', !(Number.isFinite(o.gap) && o.gap >= 0)],
    ['stripPosition', o.stripPosition !== 'top' && o.stripPosition !== 'bottom'],
    ['stripMode', !['fixed', 'overlay', 'static'].includes(o.stripMode)],
    ['mountTarget', t !== null && typeof t !== 'string' && !(t && (t as Node).nodeType === 1)],
    ['dir', !['ltr', 'rtl', 'auto'].includes(o.dir)],
  ];
  bad.forEach(([k, b]) => {
    if (b) throw new Error(`TextStrip: invalid ${k}`);
  });
  return o;
}
