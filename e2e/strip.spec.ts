import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

declare global {
  interface Window {
    top_strip: { element: HTMLElement | null; update(o: Record<string, unknown>): void; destroy(): void } | null;
    top_strip2: { element: HTMLElement | null; update(o: Record<string, unknown>): void; destroy(): void } | null;
    bottom_strip: { element: HTMLElement | null; update(o: Record<string, unknown>): void; destroy(): void } | null;
  }
}

type Pos = 'top' | 'bottom';

const DEMO = '/demo/index.html';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const open = async (page: Page, query = '') => {
  await page.goto(DEMO + query);
  await page.locator('body > [data-text-strip]').first().waitFor();
};

// The strip host has no position attribute: top is the first body child, bottom the last.
const hostLocator = (page: Page, pos: Pos) => {
  const hosts = page.locator('body > [data-text-strip]');
  return pos === 'top' ? hosts.first() : hosts.last();
};

// Reads the horizontal translate of the track inside a strip's shadow root.
const readTranslateX = (page: Page, pos: Pos) =>
  page.evaluate((p) => {
    const host = (p === 'top' ? document.body.firstElementChild : document.body.lastElementChild) as HTMLElement;
    const track = host.shadowRoot!.querySelector('.t') as HTMLElement;
    const transform = getComputedStyle(track).transform;
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
  }, pos);

const readGeometry = (page: Page, pos: Pos) =>
  page.evaluate((p) => {
    const host = (p === 'top' ? document.body.firstElementChild : document.body.lastElementChild) as HTMLElement;
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

const screenshotDir = resolve(root, 'test-results');

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

  test('a single short item still fills the strip width', async ({ page }) => {
    await open(page, '?single=1');
    const g = await readGeometry(page, 'top');
    expect(Math.abs(g.track - 2 * g.set1)).toBeLessThanOrEqual(1);
    expect(g.set1).toBeGreaterThanOrEqual(g.strip);
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
        `<script>${bundle}</script><script>window.hiddenStrip = TextStrip.create({ textArray: ['Hidden at create'], textSpeed: 60 });</script>`,
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
      const host = document.body.firstElementChild as HTMLElement;
      const bar = host.shadowRoot!.querySelector('.b') as HTMLElement;
      const track = host.shadowRoot!.querySelector('.t') as HTMLElement;
      return { animationName: getComputedStyle(track).animationName, tabindex: bar.getAttribute('tabindex') };
    });
    expect(info.animationName).toBe('none');
    expect(info.tabindex).toBe('0');

    const a = await readTranslateX(page, 'top');
    await page.waitForTimeout(300);
    expect(await readTranslateX(page, 'top')).toBe(a);
  });
});

test.describe('fixed and static modes', () => {
  const barTop = (page: Page) =>
    page.evaluate(() => {
      const host = document.body.firstElementChild as HTMLElement;
      return (host.shadowRoot!.querySelector('.b') as HTMLElement).getBoundingClientRect().top;
    });

  test('fixed mode keeps the top strip on screen while scrolling', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(100);
    expect(await barTop(page)).toBe(0);
  });

  test('static mode scrolls the top strip away with the page', async ({ page }) => {
    await open(page, '?mode=static');
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(100);
    expect(await barTop(page)).toBeLessThan(0);
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
    expect(info.itemText).toBe('Free shipping this week');
    expect(info.itemFontWeight).toBe('400');
    expect(info.itemFontStyle).toBe('normal');
    expect(info.itemLetterSpacing).toBe('normal');
    // The page's --g: 200px must not reach the shadow tree; the strip's own 32px gap gives 16px padding.
    expect(info.itemPaddingLeft).toBe('16px');
    expect(info.itemFontFamily).not.toContain('cursive');
  });
});

test.describe('grid body layout', () => {
  test('an overlay strip takes no box in a grid body and the first element stays at the top', async ({ page }) => {
    await page.setContent(
      inlinePage(
        `<header style="height: 60px">Top</header><main style="height: 200px">page</main>` +
          `<script>${bundle}</script>` +
          `<script>window.overlay = TextStrip.create({ textArray: ['Overlay strip'], pushContent: false });</script>`,
        ' style="display: grid; grid-template-rows: auto 1fr auto; margin: 0"',
      ),
    );
    const info = await page.evaluate(() => {
      const host = document.body.lastElementChild as HTMLElement;
      const rect = host.getBoundingClientRect();
      const bar = host.shadowRoot!.querySelector('.b') as HTMLElement;
      return {
        isOverlayHost: host.hasAttribute('data-text-strip') && host.hasAttribute('data-o'),
        hostWidth: rect.width,
        hostHeight: rect.height,
        firstTop: (document.body.firstElementChild as HTMLElement).getBoundingClientRect().top,
        barHeight: bar.getBoundingClientRect().height,
      };
    });
    expect(info.isOverlayHost).toBe(true);
    expect(info.hostWidth).toBe(0);
    expect(info.hostHeight).toBe(0);
    expect(info.firstTop).toBe(0);
    expect(info.barHeight).toBe(40);
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
