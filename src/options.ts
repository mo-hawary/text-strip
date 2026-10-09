export type StripPosition = 'top' | 'bottom';
export type StripMode = 'fixed' | 'static';
export type TextDir = 'ltr' | 'rtl';

export interface TextStripOptions {
  textArray: string[];
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
  pushContent?: boolean;
  closable?: boolean;
  rememberDismiss?: false | string;
  closeLabel?: string;
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
  dir: 'ltr',
  separator: '•',
  gap: 32,
  height: 40,
  fontSize: '14px',
  fontFamily: 'inherit',
  pauseOnHover: true,
  respectReducedMotion: true,
  pushContent: true,
  closable: false,
  rememberDismiss: false,
  closeLabel: 'Close',
  exposeHeightVar: false,
  zIndex: 9999,
  ariaLabel: 'Announcements',
});

const num = (v: unknown) => typeof v === 'number' && isFinite(v);

// Short messages keep the CDN bundle under its size budget; README documents each option.
export function resolveOptions(input: TextStripOptions): ResolvedOptions {
  const defined = Object.fromEntries(
    Object.entries(input || {}).filter(([, v]) => v !== undefined),
  );
  const o = { ...DEFAULTS, ...defined } as ResolvedOptions;
  const t = o.mountTarget;
  const bad: [string, boolean][] = [
    [
      'textArray',
      !Array.isArray(o.textArray) ||
        !o.textArray.length ||
        !o.textArray.every((x) => typeof x === 'string' && x.trim() !== ''),
    ],
    ['textSpeed', !num(o.textSpeed) || o.textSpeed <= 0],
    ['height', !num(o.height) || o.height <= 0],
    ['gap', !num(o.gap) || o.gap < 0],
    ['stripPosition', o.stripPosition !== 'top' && o.stripPosition !== 'bottom'],
    ['stripMode', o.stripMode !== 'fixed' && o.stripMode !== 'static'],
    ['mountTarget', t !== null && typeof t !== 'string' && !(t && (t as Node).nodeType === 1)],
    ['dir', o.dir !== 'ltr' && o.dir !== 'rtl'],
  ];
  bad.forEach(([k, b]) => {
    if (b) throw new Error(`TextStrip: invalid ${k}`);
  });
  return o;
}
