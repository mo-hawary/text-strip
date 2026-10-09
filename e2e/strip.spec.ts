import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Handle = {
  element: HTMLElement | null;
  update(o: Record<string, unknown>): void;
  pause(): void;
  play(): void;
  destroy(): void;
};

declare global {
  interface Window {
    top_strip: Handle | null;
    top_strip2: Handle | null;
    bottom_strip: Handle | null;
  }
}

type Pos = 'top' | 'bottom';

const DEMO = '/demo/index.html';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Waits for attachment, not visibility: an overlay host is display: contents, so it has no box to be visible.
const open = async (page: Page, query = '') => {
  await page.goto(DEMO + query);
  await page.locator('body > [data-text-strip]').first().waitFor({ state: 'attached' });
};

// The strip host has no position attribute: top is the first strip host, bottom the last one.
// Overlay strips are appended after the page content, so they are picked from the strip hosts only.
const hostLocator = (page: Page, pos: Pos) => {
  const hosts = page.locator('body > [data-text-strip]');
  return pos === 'top' ? hosts.first() : hosts.last();
};

// Reads the horizontal translate of the track inside a strip's shadow root.
const readTranslateX = (page: Page, pos: Pos) =>
  page.evaluate((p) => {
    const hosts = document.querySelectorAll('body > [data-text-strip]');
    const host = (p === 'top' ? hosts[0] : hosts[hosts.length - 1]) as HTMLElement;
    const track = host.shadowRoot!.querySelector('.t') as HTMLElement;
    const transform = getComputedStyle(track).transform;
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
  }, pos);

const readGeometry = (page: Page, pos: Pos) =>
  page.evaluate((p) => {
    const hosts = document.querySelectorAll('body > [data-text-strip]');
    const host = (p === 'top' ? hosts[0] : hosts[hosts.length - 1]) as HTMLElement;
    const shadow = host.shadowRoot!;
    return {
      track: (shadow.querySelector('.t') as HTMLElement).getBoundingClientRect().width,
      set1: (shadow.querySelector('.s') as HTMLElement).getBoundingClientRect().width,
      strip: (shadow.querySelector('.b') as HTMLElement).clientWidth,
    };
  }, pos);

// Pages built with setContent cannot load a relative script, so the built bundle is inlined.
const bundle = readFileSync(resolve(root, 'dist', 'index.global.js'), 'utf8');
const inlinePage = (body: string, bodyAttrs = '') =>
  `<!doctype html><html><head><meta charset="utf-8"></head><body${bodyAttrs}>${body}</body></html>`;

// Presses Tab until the top strip's shadow root reports the element matching the selector as focused.
// WebKit on macOS does not move focus to buttons or links with Tab by default, so there the element is
// focused directly; the Enter and Space presses that follow still go through the keyboard.
const focusStripElement = async (page: Page, selector: string, browserName: string) => {
  if (browserName === 'webkit') {
    await page.evaluate((sel) => {
      const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
      (host.shadowRoot!.querySelector(sel) as HTMLElement).focus();
    }, selector);
    return;
  }
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((sel) => {
      const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
      return host.shadowRoot?.activeElement?.matches(sel) ?? false;
    }, selector);
    if (hit) return;
  }
  throw new Error(`Tab never reached ${selector}`);
};

const screenshotDir = resolve(root, 'test-results');

// Texts wider than a desktop viewport, so the strip loops instead of entering fit mode.
const LONG = 'Hidden at create, a long announcement that keeps the loop running on a wide viewport. '.repeat(4);
const LONG_AR = 'مرحبا بالعالم، هذا إعلان طويل يبقي الشريط يتحرك على شاشة عريضة. '.repeat(4);

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO);
  await page.evaluate(() => localStorage.clear());
});

test.describe('track motion', () => {
  test('LTR top strip moves left and RTL bottom strip moves right', async ({ page }) => {
    await open(page);
    const topA = await readTranslateX(page, 'top');
    const bottomA = await readTranslateX(page, 'bottom');
    await page.waitForTimeout(500);
    // Poll rather than take one sample: under parallel load the first animation frames can lag.
    await expect.poll(() => readTranslateX(page, 'top')).toBeLessThan(topA);
    await expect.poll(() => readTranslateX(page, 'bottom')).toBeGreaterThan(bottomA);
  });

  test('dir auto with an Arabic first item scrolls rightwards', async ({ page }) => {
    await page.setContent(
      inlinePage(
        `<script>${bundle}</script>` +
          `<script>TextStrip.create({ textArray: [${JSON.stringify(LONG_AR)}, 'Hello'], stripPosition: 'bottom' });</script>`,
      ),
    );
    await page.locator('[data-text-strip]').waitFor();
    const info = await page.evaluate(() => {
      const host = document.querySelector('[data-text-strip]') as HTMLElement;
      const bar = host.shadowRoot!.querySelector('.b') as HTMLElement;
      const track = host.shadowRoot!.querySelector('.t') as HTMLElement;
      return { dir: bar.getAttribute('dir'), animationName: getComputedStyle(track).animationName };
    });
    expect(info).toEqual({ dir: 'rtl', animationName: 'r' });
    const readX = () =>
      page.evaluate(() => {
        const host = document.querySelector('[data-text-strip]') as HTMLElement;
        const track = host.shadowRoot!.querySelector('.t') as HTMLElement;
        const transform = getComputedStyle(track).transform;
        return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
      });
    const a = await readX();
    await page.waitForTimeout(500);
    await expect.poll(readX).toBeGreaterThan(a);
  });

  test('dir auto with a Latin first item keeps the strip left to right', async ({ page }) => {
    await page.setContent(
      inlinePage(
        `<script>${bundle}</script>` +
          `<script>TextStrip.create({ textArray: ['Hello', 'مرحبا'], stripPosition: 'bottom' });</script>`,
      ),
    );
    await page.locator('[data-text-strip]').waitFor();
    const dir = await page.evaluate(() => {
      const host = document.querySelector('[data-text-strip]') as HTMLElement;
      return host.shadowRoot!.querySelector('.b')!.getAttribute('dir');
    });
    expect(dir).toBe('ltr');
  });
});

test.describe('seamless loop', () => {
  test('track is two sets wide and one set covers the strip', async ({ page }) => {
    await open(page);
    for (const pos of ['top', 'bottom'] as const) {
      const g = await readGeometry(page, pos);
      expect(Math.abs(g.track - 2 * g.set1), pos).toBeLessThanOrEqual(1);
      expect(g.set1, pos).toBeGreaterThanOrEqual(g.strip);
    }
  });

  test('a single short item that fits is not repeated, so the track is one set wide', async ({ page }) => {
    await open(page, '?single=1');
    const g = await readGeometry(page, 'top');
    expect(Math.abs(g.track - g.set1)).toBeLessThanOrEqual(1);
    expect(g.set1).toBeLessThan(g.strip);
  });
});

test.describe('fit mode', () => {
  test('a short single text is centered, still and without a pause button', async ({ page }) => {
    await open(page, '?single=1');
    const info = await page.evaluate(() => {
      const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
      const shadow = host.shadowRoot!;
      const bar = shadow.querySelector('.b') as HTMLElement;
      const track = shadow.querySelector('.t') as HTMLElement;
      const pause = shadow.querySelector('button.y') as HTMLElement;
      const sets = shadow.querySelectorAll('.s');
      const barRect = bar.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      return {
        fit: bar.classList.contains('fit'),
        animationName: getComputedStyle(track).animationName,
        pauseDisplay: getComputedStyle(pause).display,
        hiddenSetDisplay: getComputedStyle(sets[1]).display,
        centerOffset: Math.abs(trackRect.left + trackRect.width / 2 - (barRect.left + barRect.width / 2)),
      };
    });
    expect(info.fit).toBe(true);
    expect(info.animationName).toBe('none');
    expect(info.pauseDisplay).toBe('none');
    expect(info.hiddenSetDisplay).toBe('none');
    expect(info.centerOffset).toBeLessThanOrEqual(1);

    const a = await readTranslateX(page, 'top');
    await page.waitForTimeout(300);
    expect(await readTranslateX(page, 'top')).toBe(a);
  });
});

test.describe('page layout', () => {
  test('strips reserve their own 40px and never touch body inline styles', async ({ page }) => {
    await open(page);
    const layout = () =>
      page.evaluate(() => ({
        bodyStyle: document.body.getAttribute('style'),
        bodyPaddingTop: getComputedStyle(document.body).paddingTop,
        bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
        headerTop: document.querySelector('header')!.getBoundingClientRect().top,
        topHeight: (document.body.firstElementChild as HTMLElement).getBoundingClientRect().height,
        bottomHeight: (document.body.lastElementChild as HTMLElement).getBoundingClientRect().height,
        textStripHeight: document.documentElement.style.getPropertyValue('--text-strip-height'),
      }));

    expect(await layout()).toEqual({
      bodyStyle: null,
      bodyPaddingTop: '0px',
      bodyPaddingBottom: '0px',
      headerTop: 40,
      topHeight: 40,
      bottomHeight: 40,
      textStripHeight: '40px',
    });

    await page.evaluate(() => window.top_strip!.destroy());
    const after = await layout();
    expect(after.headerTop).toBe(0);
    expect(after.textStripHeight).toBe('');
    expect(after.bodyStyle).toBeNull();
  });

  test('the sticky header stays below the strip only when the height variable is exposed', async ({ page }) => {
    const headerTopAfterScroll = () =>
      page.evaluate(() => {
        window.scrollTo(0, 300);
        return document.querySelector('header')!.getBoundingClientRect().top;
      });

    await open(page);
    expect(await headerTopAfterScroll()).toBe(40);

    await open(page, '?exposevar=0');
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--text-strip-height'))).toBe('');
    expect(await headerTopAfterScroll()).toBe(0);
  });

  test('two fixed top strips stack, the second one 40px below the first', async ({ page }) => {
    await open(page, '?stack=1');
    const tops = await page.evaluate(() => {
      const barOf = (host: HTMLElement) => host.shadowRoot!.querySelector('.b') as HTMLElement;
      const first = barOf(window.top_strip!.element!);
      const second = barOf(window.top_strip2!.element!);
      return {
        firstTop: first.getBoundingClientRect().top,
        secondTop: second.getBoundingClientRect().top,
        secondStyleTop: second.style.top,
        textStripHeight: document.documentElement.style.getPropertyValue('--text-strip-height'),
        headerTop: document.querySelector('header')!.getBoundingClientRect().top,
      };
    });
    expect(tops.firstTop).toBe(0);
    expect(tops.secondStyleTop).toBe('40px');
    expect(tops.secondTop).toBe(40);
    expect(tops.textStripHeight).toBe('80px');
    expect(tops.headerTop).toBe(80);
  });

  test('fixed, static and overlay modes place the strip and the page content differently', async ({ page }) => {
    const measure = () =>
      page.evaluate(() => {
        const hosts = document.querySelectorAll('body > [data-text-strip]');
        const top = hosts[0] as HTMLElement;
        const bar = top.shadowRoot!.querySelector('.b') as HTMLElement;
        const header = document.querySelector('header')!.getBoundingClientRect();
        const hit = document.elementFromPoint(header.left + header.width / 2, header.top + 5);
        return {
          headerTop: header.top,
          position: getComputedStyle(bar).position,
          barTop: bar.getBoundingClientRect().top,
          hostHeight: top.getBoundingClientRect().height,
          hostWidth: top.getBoundingClientRect().width,
          overlay: top.hasAttribute('data-o'),
          headerHit: hit?.tagName,
          lastIsStrip: document.body.lastElementChild === hosts[hosts.length - 1],
        };
      });

    await open(page, '?mode=fixed');
    expect(await measure()).toEqual({
      headerTop: 40,
      position: 'fixed',
      barTop: 0,
      hostHeight: 40,
      hostWidth: expect.any(Number),
      overlay: false,
      headerHit: 'HEADER',
      lastIsStrip: true,
    });

    await open(page, '?mode=static');
    const staticInfo = await measure();
    expect(staticInfo).toMatchObject({
      headerTop: 40,
      position: 'static',
      barTop: 0,
      hostHeight: 40,
      overlay: false,
      headerHit: 'HEADER',
    });

    // The overlay host has no box of its own, so the page is not pushed down and the strip covers the header.
    await open(page, '?mode=overlay&exposevar=0');
    expect(await measure()).toMatchObject({
      headerTop: 0,
      position: 'fixed',
      barTop: 0,
      hostHeight: 0,
      hostWidth: 0,
      overlay: true,
      headerHit: 'TEXT-STRIP',
      lastIsStrip: true,
    });

    // With the height variable exposed, the sticky header still moves below the overlay at scroll 0.
    await open(page, '?mode=overlay');
    expect(await measure()).toMatchObject({ headerTop: 40, hostHeight: 0, headerHit: 'HEADER' });
  });
});

test.describe('creation timing and visibility', () => {
  test('a script in head defers mounting until body exists and keeps the fixed bottom strip last', async ({ page }) => {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><script>${bundle}</script><script>` +
        `TextStrip.create({ textArray: ['Static bottom'], stripPosition: 'bottom', stripMode: 'static' });` +
        `window.fixedBottom = TextStrip.create({ textArray: ['Fixed bottom'], stripPosition: 'bottom' });` +
        `</script></head><body><main style="height: 300px">page</main></body></html>`,
    );
    const info = await page.evaluate(() => {
      const fixed = (window as unknown as { fixedBottom: { element: HTMLElement } }).fixedBottom.element;
      const bar = fixed.shadowRoot!.querySelector('.b') as HTMLElement;
      const rect = bar.getBoundingClientRect();
      const hosts = Array.from(document.body.children).filter((el) => el.hasAttribute('data-text-strip'));
      return {
        lastIsFixed: document.body.lastElementChild === fixed,
        staticThenFixed: hosts.length === 2 && hosts[1] === fixed,
        position: getComputedStyle(bar).position,
        height: rect.height,
        gapToViewportBottom: window.innerHeight - rect.bottom,
      };
    });
    expect(info.lastIsFixed).toBe(true);
    expect(info.staticThenFixed).toBe(true);
    expect(info.position).toBe('fixed');
    expect(info.height).toBe(40);
    expect(info.gapToViewportBottom).toBe(0);
  });

  test('a strip created while its body is hidden is measured once the body is shown', async ({ page }) => {
    await page.setContent(
      inlinePage(
        `<script>${bundle}</script><script>window.hiddenStrip = TextStrip.create({ textArray: [${JSON.stringify(LONG)}], textSpeed: 60 });</script>`,
        ' style="display:none"',
      ),
    );
    await page.evaluate(() => {
      document.body.style.display = '';
    });
    const read = () =>
      page.evaluate(() => {
        const host = document.querySelector('[data-text-strip]') as HTMLElement;
        const shadow = host.shadowRoot!;
        return {
          set1: (shadow.querySelector('.s') as HTMLElement).getBoundingClientRect().width,
          strip: (shadow.querySelector('.b') as HTMLElement).clientWidth,
          // Computed animation-duration is always reported in seconds, so convert to ms to match the inline value.
          durationMs:
            parseFloat(getComputedStyle(shadow.querySelector('.t') as HTMLElement).animationDuration) * 1000,
        };
      });

    await expect.poll(async () => (await read()).durationMs).not.toBe(20000);
    const r = await read();
    expect(r.set1).toBeGreaterThanOrEqual(r.strip);
    expect(Math.abs(r.durationMs - (r.set1 / 60) * 1000)).toBeLessThan(5);
  });
});

test.describe('CSP and Trusted Types', () => {
  test('a strict style-src self policy still renders a fixed 40px strip', async ({ page }) => {
    await page.goto('/demo/csp.html');
    await page.locator('body > [data-text-strip]').first().waitFor();
    const info = await page.evaluate(() => {
      const host = document.body.firstElementChild as HTMLElement;
      const bar = host.shadowRoot!.querySelector('.b') as HTMLElement;
      const track = host.shadowRoot!.querySelector('.t') as HTMLElement;
      const pageStyle = document.createElement('style');
      pageStyle.textContent = 'p { color: red }';
      document.head.appendChild(pageStyle);
      return {
        position: getComputedStyle(bar).position,
        height: bar.getBoundingClientRect().height,
        animationName: getComputedStyle(track).animationName,
        inlinePageStyleBlocked: pageStyle.sheet === null,
      };
    });
    expect(info.inlinePageStyleBlocked).toBe(true);
    expect(info.position).toBe('fixed');
    expect(info.height).toBe(40);
    expect(info.animationName).toBe('l');
  });

  test('chromium: creating a strip does not throw under require-trusted-types-for', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Trusted Types enforcement is Chromium only');
    await page.goto('/demo/csp.html');
    const result = await page.evaluate(() => {
      const ts = (window as unknown as { TextStrip: { create(o: object): { destroy(): void } } }).TextStrip;
      let enforced = false;
      try {
        document.createElement('div').innerHTML = '<b>x</b>';
      } catch {
        enforced = true;
      }
      try {
        const s = ts.create({ textArray: ['Trusted Types check'], stripPosition: 'bottom', closable: true });
        s.destroy();
        return { enforced, error: null };
      } catch (e) {
        return { enforced, error: String(e) };
      }
    });
    expect(result.enforced).toBe(true);
    expect(result.error).toBeNull();
  });
});

test.describe('pause button', () => {
  // The pause button sits after the readable links in the top strip, so Tab reaches it after the GitHub link.
  const pauseState = (page: Page) =>
    page.evaluate(() => {
      const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
      const shadow = host.shadowRoot!;
      const track = shadow.querySelector('.t') as HTMLElement;
      const button = shadow.querySelector('button.y') as HTMLButtonElement;
      return {
        playState: getComputedStyle(track).animationPlayState,
        label: button.getAttribute('aria-label'),
        focused: shadow.activeElement === button,
      };
    });

  test('Tab reaches the pause button and Enter pauses the loop', async ({ page, browserName }) => {
    await open(page);
    await focusStripElement(page, 'button.y', browserName);
    expect(await pauseState(page)).toEqual({ playState: 'running', label: 'Pause', focused: true });

    await page.keyboard.press('Enter');
    expect(await pauseState(page)).toEqual({ playState: 'paused', label: 'Play', focused: true });
  });

  test('Space pauses the loop from the keyboard', async ({ page, browserName }) => {
    await open(page);
    await focusStripElement(page, 'button.y', browserName);
    await page.keyboard.press(' ');
    expect(await pauseState(page)).toEqual({ playState: 'paused', label: 'Play', focused: true });
  });

  test('Enter resumes the loop when pressed again with the button focused', async ({ page, browserName }) => {
    await open(page);
    await focusStripElement(page, 'button.y', browserName);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    expect(await pauseState(page)).toEqual({ playState: 'running', label: 'Pause', focused: true });
  });

  test('focusing the pause button does not pause the loop', async ({ page, browserName }) => {
    await open(page);
    await focusStripElement(page, 'button.y', browserName);
    expect(await pauseState(page)).toMatchObject({ playState: 'running', focused: true });
    const a = await readTranslateX(page, 'top');
    await expect.poll(() => readTranslateX(page, 'top')).toBeLessThan(a);
  });

  test('hovering the pause button does not pause the loop', async ({ page }) => {
    await open(page);
    await page.locator('body > [data-text-strip]').first().locator('button.y').hover();
    expect(await pauseState(page)).toMatchObject({ playState: 'running', label: 'Pause' });
    const a = await readTranslateX(page, 'top');
    await expect.poll(() => readTranslateX(page, 'top')).toBeLessThan(a);
  });

  test('a second click on the pause button resumes while the pointer stays on it', async ({ page }) => {
    await open(page);
    const button = page.locator('body > [data-text-strip]').first().locator('button.y');
    await button.click();
    expect(await pauseState(page)).toMatchObject({ playState: 'paused', label: 'Play' });
    await button.click();
    expect(await pauseState(page)).toMatchObject({ playState: 'running', label: 'Pause' });
    const a = await readTranslateX(page, 'top');
    await expect.poll(() => readTranslateX(page, 'top')).toBeLessThan(a);
  });

  test('hovering the moving text pauses the loop', async ({ page }) => {
    await open(page);
    const point = await page.evaluate(() => {
      const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
      const r = (host.shadowRoot!.querySelector('.b') as HTMLElement).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(point.x, point.y);
    const hitsTrack = await page.evaluate(
      ({ x, y }) => {
        const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
        return !!(host.shadowRoot!.elementFromPoint(x, y) as HTMLElement | null)?.closest('.t');
      },
      point,
    );
    expect(hitsTrack).toBe(true);
    await expect.poll(async () => (await pauseState(page)).playState).toBe('paused');
    await page.waitForTimeout(100);
    const a = await readTranslateX(page, 'top');
    await page.waitForTimeout(300);
    expect(await readTranslateX(page, 'top')).toBe(a);
  });

  test('focusing a link in the track pauses the loop', async ({ page, browserName }) => {
    await open(page);
    await focusStripElement(page, 'a.i', browserName);
    expect(await pauseState(page)).toMatchObject({ playState: 'paused' });
    // WebKit applies the pause a frame late, so let the track settle before taking the baseline.
    await page.waitForTimeout(100);
    const a = await readTranslateX(page, 'top');
    await page.waitForTimeout(300);
    expect(await readTranslateX(page, 'top')).toBe(a);
  });

  test('a paused strip stays still while the page scrolls under it', async ({ page }) => {
    await open(page);
    await hostLocator(page, 'top').hover();
    await page.waitForTimeout(100);
    const a = await readTranslateX(page, 'top');
    await page.waitForTimeout(300);
    expect(await readTranslateX(page, 'top')).toBe(a);
  });

  test('clicking the pause button pauses the loop and labels it Play', async ({ page }) => {
    await open(page);
    await page.locator('body > [data-text-strip]').first().locator('button.y').click();
    expect(await pauseState(page)).toMatchObject({ playState: 'paused', label: 'Play' });
  });

  test('play() resumes a strip paused with pause()', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.top_strip!.pause());
    expect(await pauseState(page)).toMatchObject({ playState: 'paused', label: 'Play' });
    await page.evaluate(() => window.top_strip!.play());
    expect(await pauseState(page)).toMatchObject({ playState: 'running', label: 'Pause' });
  });
});

test.describe('pause and reduced motion', () => {
  test('hovering the top strip pauses the track', async ({ page }) => {
    await open(page);
    await hostLocator(page, 'top').hover();
    await page.waitForTimeout(100);
    const a = await readTranslateX(page, 'top');
    await page.waitForTimeout(300);
    const b = await readTranslateX(page, 'top');
    expect(b).toBe(a);
  });

  test('reduced motion turns the track animation off and makes the strip keyboard scrollable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await hostLocator(page, 'top').waitFor();
    const info = await page.evaluate(() => {
      const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
      const shadow = host.shadowRoot!;
      const bar = shadow.querySelector('.b') as HTMLElement;
      const wrap = shadow.querySelector('.w') as HTMLElement;
      const track = shadow.querySelector('.t') as HTMLElement;
      const pause = shadow.querySelector('button.y') as HTMLElement;
      return {
        animationName: getComputedStyle(track).animationName,
        tabindex: wrap.getAttribute('tabindex'),
        barTabindex: bar.getAttribute('tabindex'),
        overflowX: getComputedStyle(wrap).overflowX,
        pauseDisplay: getComputedStyle(pause).display,
      };
    });
    expect(info).toEqual({
      animationName: 'none',
      tabindex: '0',
      barTabindex: null,
      overflowX: 'auto',
      pauseDisplay: 'none',
    });

    const a = await readTranslateX(page, 'top');
    await page.waitForTimeout(300);
    expect(await readTranslateX(page, 'top')).toBe(a);
  });

  test('toggling reduced motion keeps the duration at one set width over the speed, not 3x', async ({ page }) => {
    await open(page);
    // Duration the strip should use: visible repeats times the group width, over the 60px/s speed.
    const read = () =>
      page.evaluate(() => {
        const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
        const shadow = host.shadowRoot!;
        const bar = shadow.querySelector('.b') as HTMLElement;
        const gw = (shadow.querySelector('.s .g') as HTMLElement).getBoundingClientRect().width;
        const n = Math.ceil(bar.clientWidth / gw);
        return {
          inlineMs: parseFloat((shadow.querySelector('.t') as HTMLElement).style.animationDuration),
          expectedMs: ((n * gw) / 60) * 1000,
          animationName: getComputedStyle(shadow.querySelector('.t') as HTMLElement).animationName,
        };
      });
    const matches = (r: { inlineMs: number; expectedMs: number }) => Math.abs(r.inlineMs - r.expectedMs) < 2;

    const motion = await read();
    expect(motion.animationName).toBe('l');
    expect(matches(motion)).toBe(true);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await read()).animationName).toBe('none');
    await expect.poll(async () => matches(await read())).toBe(true);
    const reduced = await read();
    expect(reduced.inlineMs).toBeCloseTo(motion.inlineMs, 0);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => (await read()).animationName).toBe('l');
    await expect.poll(async () => matches(await read())).toBe(true);
    const back = await read();
    expect(back.inlineMs).toBeCloseTo(motion.inlineMs, 0);
  });

  test('update({ dir }) keeps the loop fraction', async ({ page }) => {
    await open(page);
    await page.waitForTimeout(1000);
    const result = await page.evaluate(() => {
      const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
      const track = () => host.shadowRoot!.querySelector('.t') as HTMLElement;
      const fraction = () => {
        const dur = parseFloat(track().style.animationDuration);
        const a = track().getAnimations()[0];
        return ((Number(a.currentTime) || 0) / dur) % 1;
      };
      const before = fraction();
      window.top_strip!.update({ dir: 'rtl' });
      const after = fraction();
      return { before, after, animationName: getComputedStyle(track()).animationName };
    });
    expect(result.animationName).toBe('r');
    expect(result.before).toBeGreaterThan(0.01);
    const gap = Math.abs(result.before - result.after);
    expect(Math.min(gap, 1 - gap)).toBeLessThan(0.02);
  });
});

test.describe('hostile page CSS', () => {
  test('strip renders intact under aggressive page-wide rules', async ({ page }) => {
    await open(page, '?hostile=1');
    const info = await page.evaluate(() => {
      const host = document.body.firstElementChild as HTMLElement;
      const shadow = host.shadowRoot!;
      const bar = shadow.querySelector('.b') as HTMLElement;
      const item = shadow.querySelector('.i') as HTMLElement;
      const barRect = bar.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const itemStyle = getComputedStyle(item);
      return {
        barHeight: barRect.height,
        barWidth: barRect.width,
        viewportWidth: document.documentElement.clientWidth,
        hostHeight: host.getBoundingClientRect().height,
        itemDisplay: itemStyle.display,
        itemColor: itemStyle.color,
        itemHeight: itemRect.height,
        itemOverlapsBar: itemRect.left < barRect.right && itemRect.right > barRect.left,
        itemText: item.textContent,
        itemFontWeight: itemStyle.fontWeight,
        itemFontStyle: itemStyle.fontStyle,
        itemLetterSpacing: itemStyle.letterSpacing,
        itemPaddingLeft: itemStyle.paddingLeft,
        itemPaddingRight: itemStyle.paddingRight,
        itemFontFamily: itemStyle.fontFamily,
      };
    });
    expect(info.hostHeight).toBe(40);
    expect(info.barHeight).toBe(40);
    expect(Math.abs(info.barWidth - info.viewportWidth)).toBeLessThanOrEqual(1);
    expect(info.itemDisplay).not.toBe('none');
    expect(info.itemColor).toBe('rgb(255, 255, 255)');
    expect(info.itemHeight).toBeGreaterThan(0);
    expect(info.itemOverlapsBar).toBe(true);
    expect(info.itemText).toBe('Free shipping this week on every order over $50');
    expect(info.itemFontWeight).toBe('400');
    expect(info.itemFontStyle).toBe('normal');
    expect(info.itemLetterSpacing).toBe('normal');
    // The page's --g: 200px must not reach the shadow tree; the strip's own 32px gap gives 16px padding.
    expect(info.itemPaddingLeft).toBe('16px');
    expect(info.itemPaddingRight).toBe('16px');
    expect(info.itemFontFamily).not.toContain('cursive');
  });

  test('page ::before and ::after on the host do not add boxes to the fixed strip', async ({ page }) => {
    await open(page, '?hostile=1');
    const info = await page.evaluate(() => {
      const host = document.body.firstElementChild as HTMLElement;
      const before = getComputedStyle(host, '::before');
      const after = getComputedStyle(host, '::after');
      return {
        hostHeight: host.getBoundingClientRect().height,
        beforeDisplay: before.display,
        afterDisplay: after.display,
        spacerHeight: (host.shadowRoot!.querySelector('.sp') as HTMLElement).getBoundingClientRect().height,
      };
    });
    expect(info).toEqual({ hostHeight: 40, beforeDisplay: 'none', afterDisplay: 'none', spacerHeight: 40 });
  });

  test('an overlay host under the same hostile rules stays a 0x0 box', async ({ page }) => {
    await open(page, '?hostile=1&mode=overlay');
    const info = await page.evaluate(() => {
      const hosts = document.querySelectorAll('body > [data-text-strip]');
      const host = hosts[0] as HTMLElement;
      const rect = host.getBoundingClientRect();
      const bar = host.shadowRoot!.querySelector('.b') as HTMLElement;
      return { width: rect.width, height: rect.height, barHeight: bar.getBoundingClientRect().height };
    });
    expect(info).toEqual({ width: 0, height: 0, barHeight: 40 });
  });
});

test.describe('links', () => {
  test('the readable copy has a real focusable link to the GitHub page', async ({ page, browserName }) => {
    await open(page);
    const link = await page.evaluate(() => {
      const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
      const a = host.shadowRoot!.querySelector('a.i') as HTMLAnchorElement;
      return { text: a.textContent, href: a.getAttribute('href'), tabIndex: a.tabIndex };
    });
    expect(link).toEqual({
      text: 'Star on GitHub',
      href: 'https://github.com/mo-hawary/text-strip',
      tabIndex: 0,
    });
    await focusStripElement(page, 'a.i', browserName);
    const focused = await page.evaluate(() => {
      const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
      const active = host.shadowRoot!.activeElement as HTMLAnchorElement;
      return { tag: active.tagName, text: active.textContent };
    });
    expect(focused).toEqual({ tag: 'A', text: 'Star on GitHub' });
  });

  test('unsafe and empty hrefs are not rendered as links and no hidden copy keeps a focus stop', async ({ page }) => {
    await page.setContent(
      inlinePage(
        `<script>${bundle}</script>` +
          `<script>TextStrip.create({ textArray: [` +
          `{ text: 'Docs', href: 'https://example.com/docs' },` +
          `{ text: 'Bad', href: 'javascript:alert(1)' },` +
          `{ text: 'Data', href: 'data:text/html,<b>x</b>' },` +
          `{ text: 'Empty', href: '' },` +
          `{ text: 'Blank', href: '   ' },` +
          `{ text: 'Mail', href: 'mailto:hi@example.com' },` +
          `{ text: 'Call', href: 'tel:+15551234' }` +
          `], stripPosition: 'bottom' });</script>`,
      ),
    );
    await page.locator('[data-text-strip]').waitFor();
    const info = await page.evaluate(() => {
      const host = document.querySelector('[data-text-strip]') as HTMLElement;
      const shadow = host.shadowRoot!;
      const readable = shadow.querySelector('.s .g') as HTMLElement;
      const items = Array.from(readable.querySelectorAll('.i')) as HTMLElement[];
      const hrefs = Array.from(shadow.querySelectorAll('[href]')).map((el) => el.getAttribute('href'));
      const hiddenAnchors = Array.from(shadow.querySelectorAll('.s + .s a'));
      return {
        readable: items.map((el) => ({ tag: el.tagName, text: el.textContent, href: el.getAttribute('href') })),
        hrefs,
        hiddenTabStops: hiddenAnchors.filter((a) => (a as HTMLAnchorElement).tabIndex !== -1).length,
        hostHasLinks: host.querySelectorAll('a').length,
      };
    });
    expect(info.readable).toEqual([
      { tag: 'A', text: 'Docs', href: 'https://example.com/docs' },
      { tag: 'SPAN', text: 'Bad', href: null },
      { tag: 'SPAN', text: 'Data', href: null },
      { tag: 'SPAN', text: 'Empty', href: null },
      { tag: 'SPAN', text: 'Blank', href: null },
      { tag: 'A', text: 'Mail', href: 'mailto:hi@example.com' },
      { tag: 'A', text: 'Call', href: 'tel:+15551234' },
    ]);
    expect(info.hrefs.every((h) => /^(https:|mailto:|tel:)/.test(h ?? ''))).toBe(true);
    expect(info.hiddenTabStops).toBe(0);
    expect(info.hostHasLinks).toBe(0);
  });
});

test.describe('update and resize', () => {
  test('update() keeps keyboard focus on the close button', async ({ page }) => {
    await open(page);
    const focus = await page.evaluate(() => {
      const host = window.bottom_strip!.element!;
      const btn = host.shadowRoot!.querySelector('button.x') as HTMLButtonElement;
      btn.focus();
      const before = host.shadowRoot!.activeElement === btn;
      window.bottom_strip!.update({ textColor: '#ff0' });
      return { before, after: host.shadowRoot!.activeElement === btn };
    });
    expect(focus).toEqual({ before: true, after: true });
  });

  test('a resize keeps the top strip progress instead of restarting the loop', async ({ page }) => {
    await open(page);
    await page.waitForTimeout(1000);
    // Progress through one loop cycle, as a fraction in [0, 1).
    const read = () =>
      page.evaluate(() => {
        const track = window.top_strip!.element!.shadowRoot!.querySelector('.t') as HTMLElement;
        const a = track.getAnimations()[0];
        const duration = Number(a.effect!.getTiming().duration);
        return { progress: ((Number(a.currentTime) % duration) / duration), durationMs: duration };
      });
    const before = await read();
    expect(before.progress).toBeGreaterThan(0.01);

    await page.setViewportSize({ width: 1290, height: 720 });
    // ResizeObserver fires in one frame and the re-measure runs in the next, so wait a few frames.
    await page.evaluate(
      () =>
        new Promise<void>((done) => {
          requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => done())));
        }),
    );
    const after = await read();
    expect(after.progress).toBeGreaterThan(before.progress / 2);
  });
});

test.describe('static strip and sticky header', () => {
  test('a static top strip scrolled under a sticky header does not paint over the header', async ({ page }) => {
    // The static strip sits under the header's bottom edge once the page scrolls 20px.
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8">` +
        `<style>header{position:sticky;top:0;z-index:100;height:60px;background:#fff}</style>` +
        `</head><body style="margin:0"><header>Sticky header</header><div id="slot"></div>` +
        `<main style="height: 2000px">page</main><script>${bundle}</script>` +
        `<script>TextStrip.create({ textArray: ['Static under header'], stripMode: 'static', mountTarget: '#slot' });</script>` +
        `</body></html>`,
    );
    const hit = await page.evaluate(
      () =>
        new Promise<{ headerTop: number; tag: string | undefined }>((done) => {
          window.scrollTo(0, 20);
          requestAnimationFrame(() => {
            const header = document.querySelector('header')!;
            const r = header.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.bottom - 10);
            done({ headerTop: r.top, tag: el?.tagName });
          });
        }),
    );
    expect(hit.headerTop).toBe(0);
    expect(hit.tag).toBe('HEADER');
  });
});

test.describe('close and dismissal', () => {
  test('closing the bottom strip removes it and stays hidden after reload', async ({ page }) => {
    await open(page);
    const hosts = page.locator('body > [data-text-strip]');
    await expect(hosts).toHaveCount(2);

    await hostLocator(page, 'bottom').locator('button.x').click();
    await expect(hosts).toHaveCount(1);

    await page.reload();
    await hostLocator(page, 'top').waitFor();
    await expect(hosts).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('ts-demo-bottom'))).toBe('1');
  });
});

test.describe('scroll wrapper, focus and stacking', () => {
  test('reduced motion: scrolling the text wrapper leaves the close button in place', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setContent(
      inlinePage(
        `<script>${bundle}</script>` +
          `<script>TextStrip.create({ textArray: [${JSON.stringify(LONG)}], closable: true });</script>`,
      ),
    );
    await page.locator('[data-text-strip]').waitFor();
    const read = () =>
      page.evaluate(() => {
        const host = document.querySelector('[data-text-strip]') as HTMLElement;
        const shadow = host.shadowRoot!;
        const wrap = shadow.querySelector('.w') as HTMLElement;
        const bar = shadow.querySelector('.b') as HTMLElement;
        const close = shadow.querySelector('button.x') as HTMLElement;
        const c = close.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        return {
          overflow: wrap.scrollWidth - wrap.clientWidth,
          scrollLeft: wrap.scrollLeft,
          closeLeft: c.left,
          closeRight: c.right,
          barLeft: b.left,
          barRight: b.right,
        };
      });

    const before = await read();
    expect(before.overflow).toBeGreaterThan(300);
    await page.evaluate(() => {
      const host = document.querySelector('[data-text-strip]') as HTMLElement;
      (host.shadowRoot!.querySelector('.w') as HTMLElement).scrollLeft = 300;
    });
    const after = await read();
    expect(after.scrollLeft).toBe(300);
    expect(after.closeLeft).toBe(before.closeLeft);
    expect(after.closeRight).toBe(before.closeRight);
    expect(after.closeLeft).toBeGreaterThanOrEqual(after.barLeft);
    expect(after.closeRight).toBeLessThanOrEqual(after.barRight);
  });

  test('focusing the last of eight links does not scroll the strip or move its buttons', async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 600, height: 400 });
    const links = Array.from({ length: 8 }, (_, i) => ({
      text: `Offer number ${i + 1} on the store`,
      href: `https://example.com/offer/${i + 1}`,
    }));
    // A slow speed keeps the track close to its start, so the last link stays clipped while focus moves.
    await page.setContent(
      inlinePage(
        `<script>${bundle}</script>` +
          `<script>TextStrip.create({ textArray: ${JSON.stringify(links)}, closable: true, textSpeed: 20 });</script>`,
      ),
    );
    await page.locator('[data-text-strip]').waitFor();
    const geometry = () =>
      page.evaluate(() => {
        const host = document.querySelector('[data-text-strip]') as HTMLElement;
        const shadow = host.shadowRoot!;
        const wrap = shadow.querySelector('.w') as HTMLElement;
        const bar = shadow.querySelector('.b') as HTMLElement;
        const keep = shadow.querySelector('.k') as HTMLElement;
        const last = shadow.querySelectorAll('.s .g')[0].querySelectorAll('a.i')[7] as HTMLElement;
        return {
          barScroll: bar.scrollLeft,
          wrapScroll: wrap.scrollLeft,
          buttonsX: keep.getBoundingClientRect().left,
          lastLinkLeft: last.getBoundingClientRect().left,
          wrapRight: wrap.getBoundingClientRect().right,
        };
      });

    const pre = await geometry();
    expect(pre.lastLinkLeft).toBeGreaterThan(pre.wrapRight);

    for (let i = 1; i <= 8; i++) {
      if (browserName === 'webkit') {
        // WebKit on macOS does not move focus to links with Tab, so each link is focused directly.
        await page.evaluate((n) => {
          const host = document.querySelector('[data-text-strip]') as HTMLElement;
          const links = host.shadowRoot!.querySelectorAll('.s .g')[0].querySelectorAll('a.i');
          (links[n - 1] as HTMLElement).focus();
        }, i);
      } else {
        await page.keyboard.press('Tab');
      }
      const focused = await page.evaluate(() => {
        const host = document.querySelector('[data-text-strip]') as HTMLElement;
        return host.shadowRoot!.activeElement?.textContent ?? '';
      });
      expect(focused).toBe(`Offer number ${i} on the store`);
    }

    const during = await geometry();
    expect(during.wrapScroll).toBe(0);
    expect(during.barScroll).toBe(0);
    expect(during.buttonsX).toBe(pre.buttonsX);

    await page.evaluate(() => {
      const host = document.querySelector('[data-text-strip]') as HTMLElement;
      (host.shadowRoot!.activeElement as HTMLElement).blur();
    });
    const post = await geometry();
    expect(post.wrapScroll).toBe(0);
    expect(post.barScroll).toBe(0);
    expect(post.buttonsX).toBe(pre.buttonsX);
  });

  for (const [first, second] of [
    ['static', 'fixed'],
    ['fixed', 'static'],
  ] as const) {
    test(`a ${first} top strip and a ${second} top strip created after it do not overlap`, async ({ page }) => {
      const configs = {
        fixed: `{ textArray: ['Fixed announcement text'] }`,
        static: `{ textArray: ['Static announcement text'], stripMode: 'static' }`,
      };
      await page.setContent(
        inlinePage(
          `<main style="height: 400px">page</main>` +
            `<script>${bundle}</script>` +
            `<script>TextStrip.create(${configs[first]}); TextStrip.create(${configs[second]});</script>`,
        ),
      );
      await page.locator('[data-text-strip]').first().waitFor();
      const info = await page.evaluate(() => {
        const hosts = Array.from(document.body.children).filter(
          (el) => el.localName === 'text-strip',
        ) as HTMLElement[];
        const barOf = (h: HTMLElement) => h.shadowRoot!.querySelector('.b') as HTMLElement;
        const fixedHost = hosts.find((h) => barOf(h).classList.contains('f'))!;
        const staticHost = hosts.find((h) => !barOf(h).classList.contains('f'))!;
        const text = staticHost.shadowRoot!.querySelector('.i') as HTMLElement;
        const r = text.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const fixedBar = barOf(fixedHost).getBoundingClientRect();
        const staticBar = barOf(staticHost).getBoundingClientRect();
        return {
          order: hosts.map((h) => (h === fixedHost ? 'fixed' : 'static')),
          hitIsStatic: hit === staticHost,
          fixedTop: fixedBar.top,
          fixedBottom: fixedBar.bottom,
          fixedHeight: fixedBar.height,
          staticTop: staticBar.top,
          staticHeight: staticBar.height,
        };
      });
      expect(info.order).toEqual(['fixed', 'static']);
      expect(info.hitIsStatic).toBe(true);
      expect(info.fixedTop).toBe(0);
      expect(info.fixedHeight).toBe(40);
      expect(info.staticHeight).toBe(40);
      expect(info.staticTop).toBeGreaterThanOrEqual(info.fixedBottom);
    });
  }

  test('with pauseOnHover off, focusing a link in the track still pauses the loop', async ({
    page,
    browserName,
  }) => {
    await page.setContent(
      inlinePage(
        `<script>${bundle}</script>` +
          `<script>TextStrip.create({ textArray: [{ text: 'Read the docs', href: 'https://example.com/docs' }, ${JSON.stringify(LONG)}], pauseOnHover: false });</script>`,
      ),
    );
    await page.locator('[data-text-strip]').waitFor();
    const playState = () =>
      page.evaluate(() => {
        const host = document.querySelector('body > [data-text-strip]') as HTMLElement;
        const bar = host.shadowRoot!.querySelector('.b') as HTMLElement;
        const track = host.shadowRoot!.querySelector('.t') as HTMLElement;
        return { state: getComputedStyle(track).animationPlayState, hoverPause: bar.classList.contains('ph') };
      });
    await expect.poll(async () => (await playState()).state).toBe('running');
    expect((await playState()).hoverPause).toBe(false);

    await focusStripElement(page, 'a.i', browserName);
    await expect.poll(async () => (await playState()).state).toBe('paused');
    // WebKit applies the pause a frame late, so let the track settle before taking the baseline.
    await page.waitForTimeout(100);
    const a = await readTranslateX(page, 'top');
    await page.waitForTimeout(300);
    expect(await readTranslateX(page, 'top')).toBe(a);
  });

  test('two copies of the library on one page stack their fixed top strips', async ({ page }) => {
    type Copy = { create(o: object): { element: HTMLElement | null } };
    type Win = {
      TextStrip: Copy;
      copyA?: Copy;
      copyB?: Copy;
      stripA?: { element: HTMLElement | null };
      stripB?: { element: HTMLElement | null };
    };
    await page.setContent(inlinePage(''));

    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => {
      const w = window as unknown as Win;
      w.copyA = w.TextStrip;
      w.stripA = w.copyA.create({ textArray: ['First copy'] });
    });

    // The second script replaces the global TextStrip, so each copy is kept under its own name first.
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => {
      const w = window as unknown as Win;
      w.copyB = w.TextStrip;
      w.stripB = w.copyB.create({ textArray: ['Second copy'] });
    });

    const info = await page.evaluate(() => {
      const w = window as unknown as Win;
      const barOf = (h: HTMLElement | null) =>
        (h!.shadowRoot!.querySelector('.b') as HTMLElement).getBoundingClientRect();
      return {
        distinctCopies: w.copyA !== w.copyB,
        hosts: document.querySelectorAll('body > [data-text-strip]').length,
        firstTop: barOf(w.stripA!.element).top,
        secondTop: barOf(w.stripB!.element).top,
        secondStyleTop: (w.stripB!.element!.shadowRoot!.querySelector('.b') as HTMLElement).style.top,
      };
    });
    expect(info).toEqual({
      distinctCopies: true,
      hosts: 2,
      firstTop: 0,
      secondTop: 40,
      secondStyleTop: '40px',
    });
  });
});

test.describe('screenshots', () => {
  const viewports = [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    test(`full-page ${vp.name} ${vp.width}x${vp.height}`, async ({ page }, testInfo: TestInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page);
      await page.waitForTimeout(300);
      const body = await page.screenshot({ fullPage: true });

      mkdirSync(screenshotDir, { recursive: true });
      const file = resolve(screenshotDir, `${vp.name}-${testInfo.project.name}.png`);
      writeFileSync(file, body);
      await testInfo.attach(`${vp.name}-${testInfo.project.name}`, {
        body,
        contentType: 'image/png',
      });
    });
  }
});
