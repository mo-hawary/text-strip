import { describe, it, expect } from 'vitest';
import { DEFAULTS, resolveOptions } from '../src/options';
import type { TextStripOptions } from '../src/options';

const withTexts = (extra: Record<string, unknown>) =>
  ({ textArray: ['Hello'], ...extra }) as unknown as TextStripOptions;

describe('resolveOptions defaults', () => {
  it('applies every default when only textArray is given', () => {
    const o = resolveOptions({ textArray: ['Hello'] });
    expect(o.textArray).toEqual(['Hello']);
    for (const [key, value] of Object.entries(DEFAULTS)) {
      expect(o[key as keyof typeof o], key).toEqual(value);
    }
  });

  it('keeps explicit values over defaults', () => {
    const o = resolveOptions({ textArray: ['A'], textSpeed: 90, dir: 'rtl', stripPosition: 'bottom' });
    expect(o.textSpeed).toBe(90);
    expect(o.dir).toBe('rtl');
    expect(o.stripPosition).toBe('bottom');
  });

  it('treats undefined values as missing so defaults still apply', () => {
    const o = resolveOptions({ textArray: ['A'], textSpeed: undefined, gap: undefined });
    expect(o.textSpeed).toBe(DEFAULTS.textSpeed);
    expect(o.gap).toBe(DEFAULTS.gap);
  });

  it('accepts gap 0 and a separator of empty string', () => {
    const o = resolveOptions({ textArray: ['A'], gap: 0, separator: '' });
    expect(o.gap).toBe(0);
    expect(o.separator).toBe('');
  });
});

describe('resolveOptions validation', () => {
  it('rejects a missing textArray', () => {
    expect(() => resolveOptions({} as unknown as TextStripOptions)).toThrow(/^TextStrip:/);
  });

  const invalid: [string, Record<string, unknown>][] = [
    ['empty textArray', { textArray: [] }],
    ['non-array textArray', { textArray: 'Hello' }],
    ['blank string item', { textArray: ['   '] }],
    ['empty string item', { textArray: [''] }],
    ['non-string item', { textArray: [42] }],
    ['textSpeed 0', { textSpeed: 0 }],
    ['negative textSpeed', { textSpeed: -5 }],
    ['NaN textSpeed', { textSpeed: NaN }],
    ['height 0', { height: 0 }],
    ['negative gap', { gap: -1 }],
    ['bad stripPosition', { stripPosition: 'left' }],
    ['bad dir', { dir: 'up' }],
    ['bad stripMode', { stripMode: 'sticky' }],
    ['numeric mountTarget', { mountTarget: 42 }],
    ['plain object mountTarget', { mountTarget: {} }],
    ['text node mountTarget', { mountTarget: document.createTextNode('x') }],
  ];

  it.each(invalid)('throws a TextStrip error for %s', (_name, extra) => {
    expect(() => resolveOptions(withTexts(extra))).toThrow(/^TextStrip:/);
  });

  it('accepts null, a selector string or an element as mountTarget', () => {
    const el = document.createElement('section');
    expect(resolveOptions(withTexts({ mountTarget: null })).mountTarget).toBeNull();
    expect(resolveOptions(withTexts({ mountTarget: '#slot' })).mountTarget).toBe('#slot');
    expect(resolveOptions(withTexts({ mountTarget: el })).mountTarget).toBe(el);
  });
});

describe('resolveOptions new options', () => {
  it('defaults closeLabel to Close, exposeHeightVar to false and mountTarget to null', () => {
    const o = resolveOptions({ textArray: ['A'] });
    expect(o.closeLabel).toBe('Close');
    expect(o.exposeHeightVar).toBe(false);
    expect(o.mountTarget).toBeNull();
  });

  it('keeps an explicit closeLabel and exposeHeightVar', () => {
    const o = resolveOptions({ textArray: ['A'], closeLabel: 'Fermer', exposeHeightVar: true });
    expect(o.closeLabel).toBe('Fermer');
    expect(o.exposeHeightVar).toBe(true);
  });
});

describe('DEFAULTS', () => {
  it('is frozen so callers cannot change shared defaults', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    expect(() => {
      (DEFAULTS as Record<string, unknown>).gap = 1;
    }).toThrow();
    expect(DEFAULTS.gap).toBe(32);
  });
});
