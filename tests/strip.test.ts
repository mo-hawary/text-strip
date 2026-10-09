import { describe, it, expect, afterEach, vi } from 'vitest';
import { createTextStrip } from '../src/index';
import type { TextStrip } from '../src/index';
import { styles } from '../src/styles';

const live: TextStrip[] = [];

// Same shape as src/strip.ts: one object per page, shared by every copy of the library.
type Registry = { l: { o: unknown; b: HTMLElement }[]; e?: boolean };
const registry = () => (globalThis as unknown as Record<symbol, Registry>)[Symbol.for('text-strip')];

const make = (options: Parameters<typeof createTextStrip>[0]) => {
  const s = createTextStrip(options);
  live.push(s);
  return s;
};

const shadowOf = (host: HTMLElement) => host.shadowRoot as ShadowRoot;
const hostCount = () => document.querySelectorAll('[data-text-strip]').length;
const stripOf = (s: TextStrip) => shadowOf(s.element as HTMLElement).querySelector('.b') as HTMLElement;
const wrapOf = (s: TextStrip) => shadowOf(s.element as HTMLElement).querySelector('.w') as HTMLElement;
const spacerOf = (s: TextStrip) => shadowOf(s.element as HTMLElement).querySelector('.sp') as HTMLElement;
const pauseOf = (s: TextStrip) => shadowOf(s.element as HTMLElement).querySelector('button.y') as HTMLButtonElement;
const trackOf = (s: TextStrip) => shadowOf(s.element as HTMLElement).querySelector('.t') as HTMLElement;
// Set 0 is the readable copy, set 1 is the hidden copy that makes the loop seamless.
const groupsOf = (s: TextStrip, set: 0 | 1) =>
  Array.from(shadowOf(s.element as HTMLElement).querySelectorAll('.s')[set].querySelectorAll('.g'));

afterEach(() => {
  while (live.length) live.pop()?.destroy();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
  document.documentElement.style.removeProperty('--text-strip-height');
  localStorage.clear();
  // Every strip is destroyed above, so the shared registry must be empty again.
  expect(registry().l.length).toBe(0);
});

// Gives every element the same box so measuring code paths run in happy-dom.
// Pass the visible width of the strip and the width of one group of items.
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

// The close button column reserves 40px, so groups are measured against the room left after it.
const stubControls = () =>
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('k') ? 40 : 0;
  });

// Replaces the Web Animations lookup so the loop position can be read and written in happy-dom.
const fakeAnimation = (anim: { currentTime: number }) => {
  const orig = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getAnimations');
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', { configurable: true, value: () => [anim] });
  return () => {
    if (orig) Object.defineProperty(HTMLElement.prototype, 'getAnimations', orig);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).getAnimations;
  };
};

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
    expect(root.querySelector('button.x')?.parentElement?.parentElement).toBe(b);
  });

  it('nests the track in a scroll wrapper inside the strip, with the buttons as a sibling of the wrapper', () => {
    const s = make({ textArray: ['A'], closable: true });
    const b = stripOf(s);
    const w = wrapOf(s);
    expect(w.parentElement).toBe(b);
    expect(w.querySelector(':scope > .t')).not.toBeNull();
    expect(b.querySelector(':scope > .k')).not.toBeNull();
    expect(w.querySelector('.k')).toBeNull();
    expect(b.hasAttribute('tabindex')).toBe(false);
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

  it('sets zIndex on an overlay strip too', () => {
    const overlay = make({ textArray: ['Hi'], stripMode: 'overlay', zIndex: 800 });
    expect(stripOf(overlay).classList.contains('f')).toBe(true);
    expect(stripOf(overlay).style.zIndex).toBe('800');
  });

  it('shows the spacer at the strip height for a fixed strip', () => {
    const fixed = make({ textArray: ['Hi'], height: 44 });
    const sp = spacerOf(fixed);
    expect(sp.hidden).toBe(false);
    expect(sp.style.height).toBe('44px');
  });

  it('hides the spacer for overlay and static strips', () => {
    const overlay = make({ textArray: ['Hi'], height: 44, stripMode: 'overlay' });
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

describe('stripMode', () => {
  it('gives an overlay strip the data-o host attribute and a fixed box', () => {
    const s = make({ textArray: ['Hi'], stripMode: 'overlay' });
    expect((s.element as HTMLElement).hasAttribute('data-o')).toBe(true);
    expect(stripOf(s).classList.contains('f')).toBe(true);
  });

  it('gives fixed and static strips no data-o attribute', () => {
    const fixed = make({ textArray: ['Hi'] });
    const stat = make({ textArray: ['Hi'], stripMode: 'static' });
    expect((fixed.element as HTMLElement).hasAttribute('data-o')).toBe(false);
    expect((stat.element as HTMLElement).hasAttribute('data-o')).toBe(false);
  });

  it('moves an overlay strip to the end of body and back to the top when it becomes fixed', () => {
    document.body.innerHTML = '<main>page</main><footer>foot</footer>';
    const s = make({ textArray: ['Hi'] });
    const host = s.element as HTMLElement;
    expect(document.body.firstElementChild).toBe(host);
    s.update({ stripMode: 'overlay' });
    expect(document.body.lastElementChild).toBe(host);
    expect(host.hasAttribute('data-o')).toBe(true);
    expect(spacerOf(s).hidden).toBe(true);
    s.update({ stripMode: 'fixed' });
    expect(document.body.firstElementChild).toBe(host);
    expect(host.hasAttribute('data-o')).toBe(false);
    expect(spacerOf(s).hidden).toBe(false);
  });

  it('restores zIndex when a static strip becomes fixed again', () => {
    const s = make({ textArray: ['Hi'], stripMode: 'static', zIndex: 700 });
    expect(stripOf(s).style.zIndex).toBe('');
    s.update({ stripMode: 'fixed' });
    expect(stripOf(s).style.zIndex).toBe('700');
    s.update({ stripMode: 'static' });
    expect(stripOf(s).style.zIndex).toBe('');
  });

  it('stacks an overlay strip below a fixed strip that was created first', () => {
    const fixed = make({ textArray: ['A'], height: 40 });
    const overlay = make({ textArray: ['B'], height: 40, stripMode: 'overlay' });
    expect(stripOf(fixed).style.top).toBe('0px');
    expect(stripOf(overlay).style.top).toBe('40px');
  });

  it('stacks a fixed strip below an overlay strip that was created first', () => {
    const overlay = make({ textArray: ['A'], height: 40, stripMode: 'overlay' });
    const fixed = make({ textArray: ['B'], height: 40 });
    expect(stripOf(overlay).style.top).toBe('0px');
    expect(stripOf(fixed).style.top).toBe('40px');
  });

  it('stacks overlay and fixed bottom strips with the bottom offset', () => {
    const first = make({ textArray: ['A'], stripPosition: 'bottom', height: 36, stripMode: 'overlay' });
    const second = make({ textArray: ['B'], stripPosition: 'bottom', height: 36 });
    expect(stripOf(first).style.bottom).toBe('0px');
    expect(stripOf(second).style.bottom).toBe('36px');
  });

  it('leaves the page untouched for an overlay strip in a mounted slot', () => {
    const slot = document.createElement('section');
    slot.innerHTML = '<p>kept</p>';
    document.body.appendChild(slot);
    const s = make({ textArray: ['Hi'], mountTarget: slot, stripMode: 'overlay' });
    expect(slot.innerHTML).toBe('<p>kept</p>');
    expect(document.body.lastElementChild).toBe(s.element);
  });
});

describe('dir auto', () => {
  const dirOf = (textArray: string[], extra: Record<string, unknown> = {}) =>
    stripOf(make({ textArray, ...extra })).getAttribute('dir');

  it('is the default and picks rtl when the first strong character is Arabic', () => {
    expect(dirOf(['مرحبا بالعالم', 'Hello'])).toBe('rtl');
  });

  it('picks rtl for Hebrew first', () => {
    expect(dirOf(['שלום', 'Hello'])).toBe('rtl');
  });

  it('picks ltr when a Latin letter comes first, even if Arabic follows', () => {
    expect(dirOf(['Hello', 'مرحبا'])).toBe('ltr');
  });

  it('skips digits and punctuation before the first strong character', () => {
    expect(dirOf(['2024! - 10%', 'مرحبا'])).toBe('rtl');
    expect(dirOf(['(123) ...', 'Hello'])).toBe('ltr');
  });

  it('picks the direction from the first item that has a strong character', () => {
    expect(dirOf(['123', '!!!', 'مرحبا'])).toBe('rtl');
    expect(dirOf(['123', '!!!', 'Hello', 'مرحبا'])).toBe('ltr');
  });

  it('keeps an explicit dir over the text direction', () => {
    expect(dirOf(['مرحبا'], { dir: 'ltr' })).toBe('ltr');
    expect(dirOf(['Hello'], { dir: 'rtl' })).toBe('rtl');
  });

  it('re-decides the direction when update() changes the texts', () => {
    const s = make({ textArray: ['Hi'] });
    expect(stripOf(s).getAttribute('dir')).toBe('ltr');
    s.update({ textArray: ['مرحبا'] });
    expect(stripOf(s).getAttribute('dir')).toBe('rtl');
    s.update({ dir: 'ltr' });
    expect(stripOf(s).getAttribute('dir')).toBe('ltr');
  });

  it('picks ltr when a Cyrillic word comes first, even if Arabic follows', () => {
    expect(dirOf(['Привет', 'مرحبا'])).toBe('ltr');
  });

  it('picks ltr when a Greek word comes first, even if Arabic follows', () => {
    expect(dirOf(['Γεια σας', 'مرحبا'])).toBe('ltr');
  });

  it('picks ltr when CJK comes first, even if Arabic follows', () => {
    expect(dirOf(['你好世界', 'مرحبا'])).toBe('ltr');
  });

  it('skips Arabic-Indic digits, so a Latin letter after them still picks ltr', () => {
    expect(dirOf(['٣٤ Hello'])).toBe('ltr');
  });
});

describe('link items', () => {
  const linksOf = (s: TextStrip) =>
    Array.from(shadowOf(s.element as HTMLElement).querySelectorAll('.g')[0].querySelectorAll('.i'));

  it('renders http, https, mailto and tel items as anchors with the href', () => {
    const s = make({
      textArray: [
        { text: 'Docs', href: 'https://example.com/docs' },
        { text: 'Old', href: 'http://example.com/old' },
        { text: 'Mail', href: 'mailto:hi@example.com' },
        { text: 'Call', href: 'tel:+15551234' },
      ],
    });
    const items = linksOf(s) as HTMLAnchorElement[];
    expect(items.map((a) => a.tagName)).toEqual(['A', 'A', 'A', 'A']);
    expect(items.map((a) => a.getAttribute('href'))).toEqual([
      'https://example.com/docs',
      'http://example.com/old',
      'mailto:hi@example.com',
      'tel:+15551234',
    ]);
    expect(items.map((a) => a.textContent)).toEqual(['Docs', 'Old', 'Mail', 'Call']);
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['upper case javascript:', 'JaVaScRiPt:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript:', 'vbscript:msgbox(1)'],
  ])('renders %s as a span without an href', (_name, href) => {
    const s = make({ textArray: [{ text: 'Bad', href }] });
    const item = linksOf(s)[0];
    expect(item.tagName).toBe('SPAN');
    expect(item.hasAttribute('href')).toBe(false);
    expect(item.textContent).toBe('Bad');
    expect(shadowOf(s.element as HTMLElement).querySelector('a')).toBeNull();
  });

  it('renders link text with textContent so markup in the text is not parsed', () => {
    const s = make({ textArray: [{ text: '<b>Bold</b>', href: 'https://example.com' }] });
    const item = linksOf(s)[0] as HTMLAnchorElement;
    expect(item.textContent).toBe('<b>Bold</b>');
    expect(item.children.length).toBe(0);
  });

  it('keeps links inside the shadow tree and out of the light DOM', () => {
    const s = make({ textArray: [{ text: 'Star', href: 'https://github.com/mo-hawary/text-strip' }] });
    expect((s.element as HTMLElement).querySelector('a')).toBeNull();
    expect(shadowOf(s.element as HTMLElement).querySelector('a.i')).not.toBeNull();
  });

  it('leaves the first readable copy focusable and takes hidden copies out of the tab order', () => {
    // Two groups are needed so there is a repeated copy in set 0 as well as the hidden set 1.
    stubLayout(300, 290);
    stubControls();
    const s = make({ textArray: [{ text: 'Star', href: 'https://example.com' }], closable: true });
    const readable = groupsOf(s, 0);
    const hidden = [...groupsOf(s, 0).slice(1), ...groupsOf(s, 1)];
    expect(readable.length).toBe(2);
    const first = readable[0].querySelector('a') as HTMLAnchorElement;
    expect(first.tabIndex).not.toBe(-1);
    hidden.forEach((g) => expect((g.querySelector('a') as HTMLAnchorElement).tabIndex).toBe(-1));
  });

  it.each([
    ['an empty', ''],
    ['a whitespace-only', '   '],
  ])('renders %s href as a span, not a link to the current page', (_name, href) => {
    const s = make({ textArray: [{ text: 'Empty', href }] });
    const item = linksOf(s)[0];
    expect(item.tagName).toBe('SPAN');
    expect(item.hasAttribute('href')).toBe(false);
    expect(shadowOf(s.element as HTMLElement).querySelector('a')).toBeNull();
  });

  it('keeps text items as plain spans with no tab stop of their own', () => {
    const s = make({ textArray: ['Plain'] });
    const item = linksOf(s)[0];
    expect(item.tagName).toBe('SPAN');
    expect((item as HTMLElement).tabIndex).toBe(-1);
  });
});

describe('pause button', () => {
  it('sits in the control column next to the close button', () => {
    const s = make({ textArray: ['Hi'], closable: true });
    const pb = pauseOf(s);
    const k = pb.parentElement as HTMLElement;
    expect(pb.classList.contains('y')).toBe(true);
    expect(pb.type).toBe('button');
    expect(k.classList.contains('k')).toBe(true);
    expect(k.parentElement).toBe(stripOf(s));
    expect(k.querySelector('button.x')).not.toBeNull();
  });

  it('is labelled Pause by default and switches to Play when paused', () => {
    const s = make({ textArray: ['Hi'] });
    const pb = pauseOf(s);
    expect(pb.getAttribute('aria-label')).toBe('Pause');
    const glyph = pb.textContent;
    s.pause();
    expect(pb.getAttribute('aria-label')).toBe('Play');
    expect(pb.textContent).not.toBe(glyph);
    s.play();
    expect(pb.getAttribute('aria-label')).toBe('Pause');
    expect(pb.textContent).toBe(glyph);
  });

  it('uses pauseLabel and playLabel for its aria-label', () => {
    const s = make({ textArray: ['Hi'], pauseLabel: 'Stop news', playLabel: 'Resume news' });
    expect(pauseOf(s).getAttribute('aria-label')).toBe('Stop news');
    s.pause();
    expect(pauseOf(s).getAttribute('aria-label')).toBe('Resume news');
  });

  it('click toggles the same paused state as pause() and play()', () => {
    const s = make({ textArray: ['Hi'] });
    const pb = pauseOf(s);
    pb.click();
    expect(stripOf(s).classList.contains('paused')).toBe(true);
    expect(pb.getAttribute('aria-label')).toBe('Play');
    pb.click();
    expect(stripOf(s).classList.contains('paused')).toBe(false);
    expect(pb.getAttribute('aria-label')).toBe('Pause');
  });

  it('a click resumes a strip that was paused with pause()', () => {
    const s = make({ textArray: ['Hi'] });
    s.pause();
    pauseOf(s).click();
    expect(stripOf(s).classList.contains('paused')).toBe(false);
    expect(s.element).not.toBeNull();
  });

  it('stays visible by default and is hidden when pauseButton is false', () => {
    stubLayout(50, 100);
    const shown = make({ textArray: ['Hi'] });
    expect(pauseOf(shown).hidden).toBe(false);
    const hidden = make({ textArray: ['Hi'], pauseButton: false });
    expect(pauseOf(hidden).hidden).toBe(true);
  });

  it('is hidden in fit mode and the strip gets the fit class', () => {
    stubLayout(300, 100);
    const s = make({ textArray: ['Hi'] });
    expect(stripOf(s).classList.contains('fit')).toBe(true);
    expect(pauseOf(s).hidden).toBe(true);
  });

  it('comes back when a re-measure no longer fits', () => {
    stubLayout(300, 100);
    const s = make({ textArray: ['Hi'] });
    expect(stripOf(s).classList.contains('fit')).toBe(true);
    stubLayout(50, 100);
    s.update({});
    expect(stripOf(s).classList.contains('fit')).toBe(false);
    expect(pauseOf(s).hidden).toBe(false);
  });

  it('keeps the paused state when the texts change', () => {
    const s = make({ textArray: ['Hi'] });
    s.pause();
    s.update({ textArray: ['New'] });
    expect(stripOf(s).classList.contains('paused')).toBe(true);
    expect(pauseOf(s).getAttribute('aria-label')).toBe('Play');
  });
});

describe('fit mode', () => {
  it('shows a single group with no hidden repeat when the text fits', () => {
    stubLayout(300, 100);
    const s = make({ textArray: ['Hi'] });
    expect(groupsOf(s, 0).length).toBe(1);
    expect(groupsOf(s, 1).length).toBe(1);
    expect(stripOf(s).classList.contains('fit')).toBe(true);
  });

  it('keeps the loop with repeated groups when the text does not fit', () => {
    stubLayout(50, 100);
    const s = make({ textArray: ['Hi'] });
    expect(stripOf(s).classList.contains('fit')).toBe(false);
    expect(groupsOf(s, 0).length).toBe(1);
    expect(groupsOf(s, 1).length).toBe(1);
  });

  it('reads the fit check against the room left by the close button', () => {
    stubLayout(300, 290);
    stubControls();
    const s = make({ textArray: ['Hi'], closable: true });
    // 290px does not fit beside the 40px close column, so the loop runs with two groups.
    expect(stripOf(s).classList.contains('fit')).toBe(false);
    expect(groupsOf(s, 0).length).toBe(2);
  });

  it('removes the hidden set when the group fits, so no animation or second copy is needed', () => {
    stubLayout(300, 100);
    const s = make({ textArray: ['Hi'] });
    expect(groupsOf(s, 1).every((g) => g.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(shadowOf(s.element as HTMLElement).querySelectorAll('.s')[1].querySelectorAll('.g').length).toBe(1);
  });
});

describe('duration', () => {
  it('is one group width over the speed, in milliseconds', () => {
    stubLayout(50, 100);
    const s = make({ textArray: ['Hi'], textSpeed: 90 });
    expect(parseFloat(trackOf(s).style.animationDuration)).toBeCloseTo((100 / 90) * 1000, 5);
  });

  it('is n groups over the speed, where n covers the strip width', () => {
    stubLayout(300, 290);
    stubControls();
    const s = make({ textArray: ['Hi'], textSpeed: 60, closable: true });
    // Two groups of 290px cover the 260px left beside the close column.
    expect(parseFloat(trackOf(s).style.animationDuration)).toBeCloseTo((2 * 290 / 60) * 1000, 3);
  });

  it('follows a speed change through update()', () => {
    stubLayout(50, 100);
    const s = make({ textArray: ['Hi'], textSpeed: 50 });
    expect(parseFloat(trackOf(s).style.animationDuration)).toBeCloseTo((100 / 50) * 1000, 5);
    s.update({ textSpeed: 200 });
    expect(parseFloat(trackOf(s).style.animationDuration)).toBeCloseTo((100 / 200) * 1000, 5);
  });

  it('keeps the loop fraction when speed and dir change together', () => {
    stubLayout(50, 100);
    const anim = { currentTime: 0 };
    const restore = fakeAnimation(anim);
    try {
      const s = make({ textArray: ['Hi'], textSpeed: 60 });
      // 500ms into a 1666.67ms loop is 30 percent of the way round.
      anim.currentTime = 500;
      s.update({ textSpeed: 120, dir: 'rtl' });
      expect(anim.currentTime).toBeCloseTo(0.3 * ((100 / 120) * 1000), 3);
    } finally {
      restore();
    }
  });
});

describe('reduced motion re-measure', () => {
  it('re-checks the tab stop and the duration when the preference changes', async () => {
    let matches = false;
    const listeners: (() => void)[] = [];
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return matches;
      },
      media: '(prefers-reduced-motion: reduce)',
      addEventListener(_type: string, fn: () => void) {
        listeners.push(fn);
      },
      removeEventListener() {},
    }));
    stubLayout(50, 100);
    const s = make({ textArray: ['Hi'], textSpeed: 60 });
    expect(wrapOf(s).hasAttribute('tabindex')).toBe(false);
    const before = trackOf(s).style.animationDuration;

    matches = true;
    listeners.forEach((fn) => fn());
    expect(wrapOf(s).getAttribute('tabindex')).toBe('0');
    expect(stripOf(s).hasAttribute('tabindex')).toBe(false);
    await new Promise((done) => setTimeout(done, 20));
    expect(trackOf(s).style.animationDuration).toBe(before);
  });
});

describe('inline styles and isolation', () => {
  it('has no custom property or var() in the shadow stylesheet', () => {
    expect(styles).not.toMatch(/--[a-zA-Z]/);
    expect(styles).not.toContain('var(');
  });

  // happy-dom cannot evaluate :hover or :focus-within, so the pause contract is checked on the stylesheet.
  // The live behaviour is covered in e2e/strip.spec.ts.
  it('pauses the track only from moving content, focus inside it, or the paused class, never from controls', () => {
    const playRules = styles.match(/[^{}]*\{[^{}]*animation-play-state[^{}]*\}/g) ?? [];
    expect(playRules.length).toBeGreaterThan(0);
    const selectors = playRules.flatMap((rule) =>
      rule
        .slice(0, rule.indexOf('{'))
        .split(',')
        .map((selector) => selector.trim()),
    );
    expect(selectors.sort()).toEqual(['.paused .t', '.ph .t:hover', '.t:focus-within']);
  });

  it('neutralizes the host pseudo-elements so page ::before and ::after cannot add boxes', () => {
    expect(styles).toMatch(/:host::before,:host::after\{content:none!important;display:none!important\}/);
  });

  it('puts no custom property in any inline style inside the shadow tree', () => {
    const s = make({ textArray: [{ text: 'Star', href: 'https://example.com' }, 'Plain'], closable: true });
    const all = Array.from(shadowOf(s.element as HTMLElement).querySelectorAll('*'));
    expect(all.length).toBeGreaterThan(0);
    all.forEach((el) => expect(el.getAttribute('style') ?? '', el.className).not.toContain('--'));
  });

  it('sets the gap as inline padding on each item and separator', () => {
    const s = make({ textArray: ['A', 'B'], gap: 20 });
    const root = shadowOf(s.element as HTMLElement);
    const item = root.querySelector('.i') as HTMLElement;
    const sep = root.querySelector('.p') as HTMLElement;
    expect(item.style.paddingLeft).toBe('10px');
    expect(item.style.paddingRight).toBe('10px');
    expect(sep.style.paddingLeft).toBe('10px');
    expect(sep.style.paddingRight).toBe('10px');
  });

  it('uses zero padding when gap is 0', () => {
    const s = make({ textArray: ['A'], gap: 0 });
    const item = shadowOf(s.element as HTMLElement).querySelector('.i') as HTMLElement;
    expect(item.style.paddingLeft).toBe('0px');
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
    const s = make({ textArray: ['Hi'], mountTarget: slot, stripMode: 'overlay' });
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

  it('keeps two top strips in creation order, ahead of the page content', () => {
    document.body.innerHTML = '<main>page</main>';
    const first = make({ textArray: ['A'] });
    const second = make({ textArray: ['B'] });
    const hosts = Array.from(document.body.children).filter((el) => el.localName === 'text-strip');
    expect(hosts.length).toBe(2);
    expect(hosts[0]).toBe(first.element);
    expect(hosts[1]).toBe(second.element);
    expect(document.body.firstElementChild).toBe(first.element);
    expect(document.body.lastElementChild?.tagName).toBe('MAIN');
  });

  it('inserts a fixed top strip before a static top strip that was created first', () => {
    document.body.innerHTML = '<main>page</main>';
    const stat = make({ textArray: ['Static'], stripMode: 'static' });
    const fixed = make({ textArray: ['Fixed'] });
    expect(fixed.element?.nextElementSibling).toBe(stat.element);
    expect(document.body.firstElementChild).toBe(fixed.element);
    expect(stripOf(fixed).style.top).toBe('0px');
  });

  it('inserts a static top strip after a fixed top strip that was created first', () => {
    document.body.innerHTML = '<main>page</main>';
    const fixed = make({ textArray: ['Fixed'] });
    const stat = make({ textArray: ['Static'], stripMode: 'static' });
    expect(document.body.firstElementChild).toBe(fixed.element);
    expect(stat.element?.previousElementSibling).toBe(fixed.element);
    expect(stat.element?.nextElementSibling?.tagName).toBe('MAIN');
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
    const bottom = make({ textArray: ['Hi'], stripPosition: 'bottom', stripMode: 'overlay' });
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

describe('shared registry', () => {
  it('records each live strip on globalThis under Symbol.for("text-strip")', () => {
    const before = registry().l.length;
    const s = make({ textArray: ['Hi'] });
    expect(registry().l.length).toBe(before + 1);
    expect(registry().l.some((entry) => entry.b === stripOf(s))).toBe(true);
    s.destroy();
    expect(registry().l.length).toBe(before);
  });

  it('removes a strip from the registry when its close button is clicked', () => {
    const s = make({ textArray: ['Hi'], closable: true });
    expect(registry().l.length).toBe(1);
    (shadowOf(s.element as HTMLElement).querySelector('.x') as HTMLButtonElement).click();
    expect(registry().l.length).toBe(0);
  });

  it('stacks with a second copy of the module on the same page', async () => {
    const first = make({ textArray: ['A'], height: 40 });
    vi.resetModules();
    const copy = await import('../src/index');
    const second = copy.createTextStrip({ textArray: ['B'], height: 40 });
    live.push(second);
    expect(stripOf(first).style.top).toBe('0px');
    expect(stripOf(second).style.top).toBe('40px');
    expect(registry().l.length).toBe(2);
  });

  it('shares the height variable flag between copies', async () => {
    const exposing = make({ textArray: ['A'], height: 40, exposeHeightVar: true });
    vi.resetModules();
    const copy = await import('../src/index');
    const second = copy.createTextStrip({ textArray: ['B'], height: 40 });
    live.push(second);
    expect(document.documentElement.style.getPropertyValue('--text-strip-height')).toBe('80px');
    exposing.destroy();
    expect(document.documentElement.style.getPropertyValue('--text-strip-height')).toBe('');
  });
});

describe('validation', () => {
  it('reports an invalid textSpeed with the TextStrip prefix and option name', () => {
    expect(() => createTextStrip({ textArray: ['Hi'], textSpeed: 0 })).toThrow(/^TextStrip: invalid textSpeed$/);
  });

  it('rejects numeric options passed as strings', () => {
    expect(() => createTextStrip({ textArray: ['Hi'], textSpeed: '60' as unknown as number })).toThrow(
      /^TextStrip: invalid textSpeed$/,
    );
    expect(() => createTextStrip({ textArray: ['Hi'], height: '40' as unknown as number })).toThrow(
      /^TextStrip: invalid height$/,
    );
    expect(() => createTextStrip({ textArray: ['Hi'], gap: '32' as unknown as number })).toThrow(
      /^TextStrip: invalid gap$/,
    );
  });

  it('rejects an invalid update and keeps the strip as it was', () => {
    const s = make({ textArray: ['Hi'], textSpeed: 60 });
    expect(() => s.update({ textSpeed: '60' as unknown as number })).toThrow(/^TextStrip: invalid textSpeed$/);
    expect(() => s.update({ stripMode: 'sticky' as unknown as 'fixed' })).toThrow(/^TextStrip: invalid stripMode$/);
    expect(() => s.update({ textArray: [{ text: 'no href' } as unknown as string] })).toThrow(
      /^TextStrip: invalid textArray$/,
    );
    expect(stripOf(s).classList.contains('f')).toBe(true);
  });

  it('rejects a link item without href at create time', () => {
    expect(() => createTextStrip({ textArray: [{ text: 'Docs' } as unknown as string] })).toThrow(
      /^TextStrip: invalid textArray$/,
    );
  });
});

describe('--text-strip-height', () => {
  it('is not set by default and leaves the root style untouched', () => {
    const before = document.documentElement.style.cssText;
    const s = make({ textArray: ['Hi'], height: 52, stripMode: 'overlay' });
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
    stubLayout(50, 100);
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
    expect(wrapOf(s).getAttribute('tabindex')).toBe('0');
  });

  it('puts the tab stop on the scroll wrapper and never on the strip box', () => {
    stubMotion(true);
    const s = make({ textArray: ['Hi'], closable: true });
    expect(wrapOf(s).getAttribute('tabindex')).toBe('0');
    expect(stripOf(s).hasAttribute('tabindex')).toBe(false);
    expect(shadowOf(s.element as HTMLElement).querySelector('.k')?.hasAttribute('tabindex')).toBe(false);
  });

  it('does not make the strip focusable when respectReducedMotion is false', () => {
    stubMotion(true);
    const s = make({ textArray: ['Hi'], respectReducedMotion: false });
    expect(wrapOf(s).hasAttribute('tabindex')).toBe(false);
  });

  it('does not make the strip focusable when the query does not match', () => {
    stubMotion(false);
    const s = make({ textArray: ['Hi'] });
    expect(wrapOf(s).hasAttribute('tabindex')).toBe(false);
  });
});

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
