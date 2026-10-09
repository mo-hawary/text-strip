import { describe, it, expect, afterEach, vi } from 'vitest';
import { createTextStrip } from '../src/index';
import type { TextStrip } from '../src/index';

const live: TextStrip[] = [];

const make = (options: Parameters<typeof createTextStrip>[0]) => {
  const s = createTextStrip(options);
  live.push(s);
  return s;
};

const shadowOf = (host: HTMLElement) => host.shadowRoot as ShadowRoot;
const hostCount = () => document.querySelectorAll('[data-text-strip]').length;
const stripOf = (s: TextStrip) => shadowOf(s.element as HTMLElement).querySelector('.b') as HTMLElement;
const spacerOf = (s: TextStrip) => shadowOf(s.element as HTMLElement).querySelector('.sp') as HTMLElement;

afterEach(() => {
  while (live.length) live.pop()?.destroy();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
  document.documentElement.style.removeProperty('--text-strip-height');
  localStorage.clear();
});

describe('createTextStrip DOM', () => {
  it('creates exactly one <text-strip> host with an open shadow root, role and aria-label', () => {
    const s = make({ textArray: ['Hello'], ariaLabel: 'News' });
    const host = s.element as HTMLElement;
    expect(hostCount()).toBe(1);
    expect(host.tagName.toLowerCase()).toBe('text-strip');
    expect(host.parentElement).toBe(document.body);
    expect(host.hasAttribute('data-text-strip')).toBe(true);
    expect(host.getAttribute('role')).toBe('region');
    expect(host.getAttribute('aria-label')).toBe('News');
    expect(shadowOf(host)).not.toBeNull();
    expect(shadowOf(host).mode).toBe('open');
  });

  it('puts no inline style or custom property on the host', () => {
    const s = make({ textArray: ['Hi'], height: 52, dir: 'rtl', stripPosition: 'bottom' });
    expect((s.element as HTMLElement).hasAttribute('style')).toBe(false);
  });

  it('renders texts with textContent so markup is shown as text, not elements', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const s = make({ textArray: ['Plain', payload] });
    const root = shadowOf(s.element as HTMLElement);
    const firstSet = root.querySelector('.s') as HTMLElement;
    const items = Array.from(firstSet.querySelectorAll('.g')[0].querySelectorAll('.i'));
    expect(items.map((i) => i.textContent)).toEqual(['Plain', payload]);
    expect(root.querySelector('img')).toBeNull();
  });

  it('builds the shadow tree as spacer then strip, with a track holding two sets', () => {
    const s = make({ textArray: ['A'] });
    const root = shadowOf(s.element as HTMLElement);
    const sp = spacerOf(s);
    const b = stripOf(s);
    expect(sp.nextElementSibling).toBe(b);
    const track = b.querySelector('.t') as HTMLElement;
    expect(track.querySelectorAll(':scope > .s').length).toBe(2);
    expect(root.querySelector('button.x')?.parentElement).toBe(b);
  });

  it('marks the second set and every repeated group as aria-hidden', () => {
    const s = make({ textArray: ['A'], textSpeed: 60 });
    const root = shadowOf(s.element as HTMLElement);
    const sets = root.querySelectorAll('.s');
    expect(sets.length).toBe(2);
    expect(sets[0].hasAttribute('aria-hidden')).toBe(false);
    expect(sets[1].getAttribute('aria-hidden')).toBe('true');
    const groups = Array.from(sets[0].querySelectorAll('.g'));
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].hasAttribute('aria-hidden')).toBe(false);
    groups.slice(1).forEach((g) => expect(g.getAttribute('aria-hidden')).toBe('true'));
  });

  it('marks separator spans aria-hidden', () => {
    const s = make({ textArray: ['A', 'B'], separator: '•' });
    const root = shadowOf(s.element as HTMLElement);
    const seps = Array.from(root.querySelectorAll('.p'));
    expect(seps.length).toBeGreaterThan(0);
    seps.forEach((p) => {
      expect(p.getAttribute('aria-hidden')).toBe('true');
      expect(p.textContent).toBe('•');
    });
  });

  it('sets dir on the strip for rtl and ltr', () => {
    const rtl = make({ textArray: ['مرحبا'], dir: 'rtl' });
    expect(stripOf(rtl).getAttribute('dir')).toBe('rtl');
    rtl.destroy();
    const ltr = make({ textArray: ['Hi'] });
    expect(stripOf(ltr).getAttribute('dir')).toBe('ltr');
  });

  it('places a top strip first in body and a bottom strip last', () => {
    document.body.innerHTML = '<main>page</main><footer>foot</footer>';
    const top = make({ textArray: ['Hi'], stripPosition: 'top' });
    expect(document.body.firstElementChild).toBe(top.element);
    const bottom = make({ textArray: ['Hi'], stripPosition: 'bottom' });
    expect(document.body.lastElementChild).toBe(bottom.element);
    expect(document.body.firstElementChild).toBe(top.element);
  });

  it('marks the strip fixed by default and not fixed for stripMode static', () => {
    const fixed = make({ textArray: ['Hi'] });
    expect(stripOf(fixed).classList.contains('f')).toBe(true);
    fixed.destroy();
    const stat = make({ textArray: ['Hi'], stripMode: 'static' });
    expect(stripOf(stat).classList.contains('f')).toBe(false);
  });

  it('sets zIndex on the strip only in fixed mode, so static strips do not paint over sticky headers', () => {
    const fixed = make({ textArray: ['Hi'], zIndex: 500 });
    expect(stripOf(fixed).style.zIndex).toBe('500');
    const stat = make({ textArray: ['Hi'], stripMode: 'static', zIndex: 500 });
    expect(stripOf(stat).style.zIndex).toBe('');
  });

  it('shows the spacer at the strip height for a pushing fixed strip', () => {
    const pushed = make({ textArray: ['Hi'], height: 44 });
    const sp = spacerOf(pushed);
    expect(sp.hidden).toBe(false);
    expect(sp.style.height).toBe('44px');
  });

  it('hides the spacer for overlay (pushContent false) and static strips', () => {
    const overlay = make({ textArray: ['Hi'], height: 44, pushContent: false });
    expect(spacerOf(overlay).hidden).toBe(true);
    overlay.destroy();
    const stat = make({ textArray: ['Hi'], height: 44, stripMode: 'static' });
    expect(spacerOf(stat).hidden).toBe(true);
  });

  it('shows the close button only when closable', () => {
    const plain = make({ textArray: ['Hi'] });
    const btnPlain = shadowOf(plain.element as HTMLElement).querySelector('.x') as HTMLButtonElement;
    expect(btnPlain.hidden).toBe(true);
    plain.destroy();

    const closable = make({ textArray: ['Hi'], closable: true });
    const btn = shadowOf(closable.element as HTMLElement).querySelector('.x') as HTMLButtonElement;
    expect(btn.hidden).toBe(false);
    expect(btn.getAttribute('aria-label')).toBe('Close');
  });

  it('uses closeLabel as the close button aria-label', () => {
    const s = make({ textArray: ['Hi'], closable: true, closeLabel: 'Fermer' });
    const btn = shadowOf(s.element as HTMLElement).querySelector('.x') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Fermer');
  });

  it('renders a single group while the strip has no width', () => {
    const s = make({ textArray: ['Hi'] });
    const sets = shadowOf(s.element as HTMLElement).querySelectorAll('.s');
    expect(sets[0].querySelectorAll('.g').length).toBe(1);
    expect(sets[1].querySelectorAll('.g').length).toBe(1);
  });
});

describe('mounting', () => {
  it('inserts a top strip as the first child of mountTarget and a bottom strip as the last', () => {
    const slot = document.createElement('section');
    slot.innerHTML = '<p>one</p><p>two</p>';
    document.body.appendChild(slot);
    const top = make({ textArray: ['Hi'], mountTarget: slot });
    expect(slot.firstElementChild).toBe(top.element);
    const bottom = make({ textArray: ['Hi'], mountTarget: slot, stripPosition: 'bottom' });
    expect(slot.lastElementChild).toBe(bottom.element);
    expect(document.body.lastElementChild).toBe(slot);
  });

  it('resolves a selector string mountTarget', () => {
    document.body.innerHTML = '<div id="slot"><span>x</span></div>';
    const s = make({ textArray: ['Hi'], mountTarget: '#slot' });
    expect(document.querySelector('#slot')?.firstElementChild).toBe(s.element);
  });

  it('falls back to body when the selector matches nothing', () => {
    document.body.innerHTML = '<main>page</main>';
    const s = make({ textArray: ['Hi'], mountTarget: '#missing' });
    expect(document.body.firstElementChild).toBe(s.element);
  });

  it('appends an overlay strip last in body with data-o, even when mountTarget is set', () => {
    const slot = document.createElement('section');
    document.body.append(slot, document.createElement('footer'));
    const s = make({ textArray: ['Hi'], mountTarget: slot, pushContent: false });
    const host = s.element as HTMLElement;
    expect(host.hasAttribute('data-o')).toBe(true);
    expect(document.body.lastElementChild).toBe(host);
    expect(slot.contains(host)).toBe(false);
  });

  it('inserts a static strip first in body without data-o', () => {
    document.body.innerHTML = '<main>page</main>';
    const top = make({ textArray: ['Hi'], stripMode: 'static' });
    expect(document.body.firstElementChild).toBe(top.element);
    expect((top.element as HTMLElement).hasAttribute('data-o')).toBe(false);
  });

  it('throws a TextStrip error for a mountTarget that is not an element, selector or null', () => {
    expect(() => createTextStrip({ textArray: ['Hi'], mountTarget: 42 as unknown as Element })).toThrow(
      /^TextStrip:/,
    );
  });

  it('leaves body and pre-existing elements untouched on create, update and destroy', () => {
    document.body.innerHTML = '<main class="page" style="color: red">page</main><footer>foot</footer>';
    const snapshot = () => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-text-strip]').forEach((n) => n.remove());
      return clone.outerHTML;
    };
    const before = snapshot();
    const htmlStyle = document.documentElement.getAttribute('style');
    const top = make({ textArray: ['Hi'], closable: true });
    const bottom = make({ textArray: ['Hi'], stripPosition: 'bottom', pushContent: false });
    expect(snapshot()).toBe(before);
    top.update({ textSpeed: 90, height: 52, exposeHeightVar: true });
    expect(snapshot()).toBe(before);
    top.destroy();
    bottom.destroy();
    expect(snapshot()).toBe(before);
    expect(document.documentElement.getAttribute('style')).toBe(htmlStyle);
  });
});

describe('stacking', () => {
  it('stacks two top strips below each other', () => {
    const first = make({ textArray: ['A'], height: 40 });
    const second = make({ textArray: ['B'], height: 40 });
    expect(stripOf(first).style.top).toBe('0px');
    expect(stripOf(second).style.top).toBe('40px');
  });

  it('re-stacks the remaining strips when an earlier one is destroyed', () => {
    const first = make({ textArray: ['A'], height: 40 });
    const second = make({ textArray: ['B'], height: 40 });
    first.destroy();
    expect(stripOf(second).style.top).toBe('0px');
  });

  it('stacks bottom strips with the bottom offset', () => {
    const first = make({ textArray: ['A'], stripPosition: 'bottom', height: 36 });
    const second = make({ textArray: ['B'], stripPosition: 'bottom', height: 36 });
    expect(stripOf(first).style.bottom).toBe('0px');
    expect(stripOf(second).style.bottom).toBe('36px');
  });

  it('ignores static strips when stacking fixed ones', () => {
    make({ textArray: ['Static'], stripMode: 'static', height: 40 });
    const fixed = make({ textArray: ['Fixed'], height: 40 });
    expect(stripOf(fixed).style.top).toBe('0px');
  });

  it('skips a detached host that was removed without destroy', () => {
    const detached = make({ textArray: ['A'], height: 40 });
    (detached.element as HTMLElement).remove();
    const next = make({ textArray: ['B'], height: 40 });
    expect(stripOf(next).style.top).toBe('0px');
  });
});

describe('validation', () => {
  it('reports an invalid textSpeed with the TextStrip prefix and option name', () => {
    expect(() => createTextStrip({ textArray: ['Hi'], textSpeed: 0 })).toThrow(/^TextStrip: invalid textSpeed$/);
  });
});

describe('--text-strip-height', () => {
  it('is not set by default and leaves the root style untouched', () => {
    const before = document.documentElement.style.cssText;
    const s = make({ textArray: ['Hi'], height: 52, pushContent: false });
    expect(document.documentElement.style.cssText).toBe(before);
    s.update({ textSpeed: 90 });
    expect(document.documentElement.style.cssText).toBe(before);
    s.destroy();
    expect(document.documentElement.style.cssText).toBe(before);
  });

  it('sums the heights of live fixed top strips that expose it', () => {
    const first = make({ textArray: ['A'], height: 40, exposeHeightVar: true });
    expect(document.documentElement.style.getPropertyValue('--text-strip-height')).toBe('40px');
    make({ textArray: ['B'], height: 40, exposeHeightVar: true });
    expect(document.documentElement.style.getPropertyValue('--text-strip-height')).toBe('80px');
    first.destroy();
    expect(document.documentElement.style.getPropertyValue('--text-strip-height')).toBe('40px');
  });

  it('is 0px for a bottom strip that exposes it', () => {
    make({ textArray: ['A'], stripPosition: 'bottom', height: 40, exposeHeightVar: true });
    expect(document.documentElement.style.getPropertyValue('--text-strip-height')).toBe('0px');
  });

  it('is removed once no live strip exposes it', () => {
    const exposing = make({ textArray: ['A'], height: 40, exposeHeightVar: true });
    const plain = make({ textArray: ['B'], height: 40 });
    exposing.destroy();
    expect(document.documentElement.style.getPropertyValue('--text-strip-height')).toBe('');
    plain.destroy();
    expect(document.documentElement.style.getPropertyValue('--text-strip-height')).toBe('');
  });
});

describe('pause, play, update and destroy', () => {
  it('pause() and play() toggle the paused class on the strip', () => {
    const s = make({ textArray: ['Hi'] });
    const strip = stripOf(s);
    s.pause();
    expect(strip.classList.contains('paused')).toBe(true);
    s.play();
    expect(strip.classList.contains('paused')).toBe(false);
  });

  it('update() replaces texts and keeps the same host element', () => {
    const s = make({ textArray: ['Old'] });
    const host = s.element;
    s.update({ textArray: ['New one', 'New two'] });
    expect(s.element).toBe(host);
    expect(hostCount()).toBe(1);
    const firstGroup = shadowOf(host as HTMLElement).querySelector('.s .g') as HTMLElement;
    expect(Array.from(firstGroup.querySelectorAll('.i')).map((i) => i.textContent)).toEqual([
      'New one',
      'New two',
    ]);
  });

  it('update() ignores undefined values and keeps the current option', () => {
    stubLayout(300, 100);
    const s = make({ textArray: ['Hi'], textSpeed: 90 });
    const track = shadowOf(s.element as HTMLElement).querySelector('.t') as HTMLElement;
    // The track duration is written in milliseconds: one 100px group at 90px/s is 1111.11ms.
    const ms = () => parseFloat(track.style.animationDuration);
    expect(track.style.animationDuration.endsWith('ms')).toBe(true);
    expect(ms()).toBeCloseTo((100 / 90) * 1000, 5);
    s.update({ textSpeed: undefined });
    expect(ms()).toBeCloseTo((100 / 90) * 1000, 5);
    s.update({ textSpeed: 50 });
    expect(ms()).toBeCloseTo((100 / 50) * 1000, 5);
  });

  it('update() keeps the host node and its DOM position when only paint options change', () => {
    document.body.innerHTML = '<main>page</main><footer>foot</footer>';
    const s = make({ textArray: ['Hi'] });
    const host = s.element as HTMLElement;
    const insert = vi.spyOn(document.body, 'insertBefore');
    s.update({ textColor: '#ff0' });
    expect(insert).not.toHaveBeenCalled();
    expect(host.parentElement).toBe(document.body);
    expect(document.body.firstElementChild).toBe(host);
    expect(stripOf(s).style.color).toBe('#ff0');
  });

  it('update() moves the host when stripPosition changes', () => {
    document.body.innerHTML = '<main>page</main><footer>foot</footer>';
    const s = make({ textArray: ['Hi'] });
    const host = s.element as HTMLElement;
    expect(document.body.firstElementChild).toBe(host);
    s.update({ stripPosition: 'bottom' });
    expect(document.body.lastElementChild).toBe(host);
    expect(stripOf(s).style.bottom).toBe('0px');
    s.update({ stripPosition: 'top' });
    expect(document.body.firstElementChild).toBe(host);
  });

  it('update() switches stripMode and dir at runtime', () => {
    const s = make({ textArray: ['Hi'] });
    s.update({ stripMode: 'static', dir: 'rtl' });
    expect(stripOf(s).classList.contains('f')).toBe(false);
    expect(spacerOf(s).hidden).toBe(true);
    expect(stripOf(s).getAttribute('dir')).toBe('rtl');
  });

  it('destroy() removes the host and is idempotent', () => {
    const s = make({ textArray: ['Hi'] });
    s.destroy();
    expect(hostCount()).toBe(0);
    expect(() => s.destroy()).not.toThrow();
    expect(hostCount()).toBe(0);
  });
});

describe('reduced motion', () => {
  const stubMotion = (matches: boolean) =>
    vi.stubGlobal('matchMedia', () => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener() {},
      removeEventListener() {},
    }));

  it('makes the strip keyboard focusable when reduced motion is requested', () => {
    stubMotion(true);
    const s = make({ textArray: ['Hi'] });
    expect(stripOf(s).getAttribute('tabindex')).toBe('0');
  });

  it('does not make the strip focusable when respectReducedMotion is false', () => {
    stubMotion(true);
    const s = make({ textArray: ['Hi'], respectReducedMotion: false });
    expect(stripOf(s).hasAttribute('tabindex')).toBe(false);
  });

  it('does not make the strip focusable when the query does not match', () => {
    stubMotion(false);
    const s = make({ textArray: ['Hi'] });
    expect(stripOf(s).hasAttribute('tabindex')).toBe(false);
  });
});

// Gives every element the same box so measuring code paths run in happy-dom.
const stubLayout = (clientWidth: number, width: number) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 40,
    width,
    height: 40,
    toJSON() {},
  } as DOMRect);
};

describe('close and dismissal', () => {
  it('clicking close removes the strip, calls onClose and stores the dismissal key', () => {
    let closed = 0;
    const s = make({
      textArray: ['Hi'],
      closable: true,
      rememberDismiss: 'ts-test-key',
      onClose: () => {
        closed++;
      },
    });
    const btn = shadowOf(s.element as HTMLElement).querySelector('.x') as HTMLButtonElement;
    btn.click();
    expect(hostCount()).toBe(0);
    expect(closed).toBe(1);
    expect(localStorage.getItem('ts-test-key')).toBe('1');
  });

  it('closing a stacked strip re-stacks the strips below it', () => {
    const first = make({ textArray: ['A'], height: 40, closable: true });
    const second = make({ textArray: ['B'], height: 40 });
    const btn = shadowOf(first.element as HTMLElement).querySelector('.x') as HTMLButtonElement;
    btn.click();
    expect(stripOf(second).style.top).toBe('0px');
  });

  it('does not store anything when rememberDismiss is false', () => {
    const s = make({ textArray: ['Hi'], closable: true });
    const btn = shadowOf(s.element as HTMLElement).querySelector('.x') as HTMLButtonElement;
    btn.click();
    expect(hostCount()).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('a later create with the same dismissal key returns no element', () => {
    const first = make({ textArray: ['Hi'], closable: true, rememberDismiss: 'ts-test-key' });
    (shadowOf(first.element as HTMLElement).querySelector('.x') as HTMLButtonElement).click();
    const again = make({ textArray: ['Hi'], rememberDismiss: 'ts-test-key' });
    expect(again.element).toBeNull();
    expect(hostCount()).toBe(0);
  });
});

describe('SSR', () => {
  it('returns an inert instance with a null element when document is undefined', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'document');
    try {
      expect(typeof document).toBe('undefined');
      const s = createTextStrip({ textArray: ['Hi'] });
      expect(s.element).toBeNull();
      expect(() => {
        s.update({ textSpeed: 90 });
        s.pause();
        s.play();
        s.destroy();
      }).not.toThrow();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    }
    expect(typeof document).toBe('object');
  });

  it('still validates options on the server', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'document');
    try {
      expect(() => createTextStrip({ textArray: [] })).toThrow(/^TextStrip:/);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    }
  });
});
