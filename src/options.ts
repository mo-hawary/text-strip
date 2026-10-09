// Public option types, the defaults, and validation of caller options.
// resolveOptions merges a partial set of options over a base and throws on any value the strip cannot use.

/** Edge of the page the strip sits on. */
export type StripPosition = 'top' | 'bottom';
/** How the strip sits on the page: reserves space, floats over the page, or scrolls with the flow. */
export type StripMode = 'fixed' | 'overlay' | 'static';
/** Text direction. 'auto' follows the first strong character of the texts. */
export type TextDir = 'ltr' | 'rtl' | 'auto';
/** One item of the loop: a plain text, or a text that links to an href. */
export type TextItem = string | { text: string; href: string };

/** Options accepted by createTextStrip. Every option except textArray has a default. */
export interface TextStripOptions {
  textArray: TextItem[];
  stripBgColor?: string;
  textColor?: string;
  /** Scroll speed in pixels per second. */
  textSpeed?: number;
  stripPosition?: StripPosition;
  stripMode?: StripMode;
  /** Where the strip is inserted in fixed and static modes. Null means the body. */
  mountTarget?: Element | string | null;
  dir?: TextDir;
  separator?: string;
  /** Space in pixels on each side of the separator. */
  gap?: number;
  height?: number;
  fontSize?: string;
  fontFamily?: string;
  pauseOnHover?: boolean;
  respectReducedMotion?: boolean;
  closable?: boolean;
  /** localStorage key that remembers a dismissal, or false to forget dismissals. */
  rememberDismiss?: false | string;
  closeLabel?: string;
  pauseButton?: boolean;
  pauseLabel?: string;
  playLabel?: string;
  /** Opt-in: publish the total height of the top fixed and overlay strips as --text-strip-height. */
  exposeHeightVar?: boolean;
  zIndex?: number;
  ariaLabel?: string;
  onClose?: () => void;
}

/** Options after defaults are applied. Every field is set, except onClose which stays optional. */
export type ResolvedOptions = Required<Omit<TextStripOptions, 'onClose'>> &
  Pick<TextStripOptions, 'onClose'>;

/** Default value of every option except textArray. Frozen, so callers cannot change the shared defaults. */
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

/** A text item is valid when it has visible text, and a link also needs an href string. */
function isValidItem(item: TextItem): boolean {
  if (typeof item === 'string') return item.trim() !== '';
  return !!item && typeof item.text === 'string' && item.text.trim() !== '' && typeof item.href === 'string';
}

/**
 * Returns the name of the first option with an unusable value, or undefined when all values are usable.
 * Every check is listed, and the first failing check wins, in this order.
 */
function findInvalidOption(options: ResolvedOptions): string | undefined {
  const target = options.mountTarget;
  const checks: [string, boolean][] = [
    ['textArray', !Array.isArray(options.textArray) || !options.textArray.length || !options.textArray.every(isValidItem)],
    ['textSpeed', !(Number.isFinite(options.textSpeed) && options.textSpeed > 0)],
    ['height', !(Number.isFinite(options.height) && options.height > 0)],
    ['gap', !(Number.isFinite(options.gap) && options.gap >= 0)],
    ['stripPosition', options.stripPosition !== 'top' && options.stripPosition !== 'bottom'],
    ['stripMode', !['fixed', 'overlay', 'static'].includes(options.stripMode)],
    ['mountTarget', target !== null && typeof target !== 'string' && !(target && (target as Node).nodeType === 1)],
    ['dir', !['ltr', 'rtl', 'auto'].includes(options.dir)],
  ];
  const failed = checks.find(([, isBad]) => isBad);
  return failed && failed[0];
}

/**
 * Merges caller options over a base and validates the result.
 * An option passed as undefined keeps the base value (the defaults, or the current options on update).
 * Throws `TextStrip: invalid <option>` for the first unusable value. The input is not modified.
 */
export function resolveOptions(input: Partial<TextStripOptions>, base: object = DEFAULTS): ResolvedOptions {
  const defined = Object.fromEntries(Object.entries(input || {}).filter(([, value]) => value !== undefined));
  const merged = { ...base, ...defined } as ResolvedOptions;
  const invalid = findInvalidOption(merged);
  if (invalid) throw new Error(`TextStrip: invalid ${invalid}`);
  return merged;
}
