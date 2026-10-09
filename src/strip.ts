import { resolveOptions } from './options';
import type { ResolvedOptions, TextStripOptions } from './options';
import { styles } from './styles';

export interface TextStrip {
  element: HTMLElement | null;
  update(o: Partial<TextStripOptions>): void;
  pause(): void;
  play(): void;
  destroy(): void;
}

interface Live {
  o: ResolvedOptions;
  b: HTMLElement;
}

const VAR = '--text-strip-height';
const live: Live[] = [];
let exposed = false;
let sheet: CSSStyleSheet | undefined;

const inert = (): TextStrip => ({
  element: null,
  update() {},
  pause() {},
  play() {},
  destroy() {},
});

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: Node, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  parent?.appendChild(e);
  return e;
};

// Constructable sheets are not blocked by a style-src CSP; <style> is the fallback for old browsers.
const adopt = (root: ShadowRoot) => {
  try {
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(styles);
    }
    root.adoptedStyleSheets = [sheet];
  } catch {
    make('style', '', root, styles);
  }
};

const store = (key: string, set?: boolean) => {
  try {
    if (set) localStorage.setItem(key, '1');
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

// Stacks fixed strips that share a side and keeps the optional height variable in sync.
const relayout = () => {
  const off = { top: 0, bottom: 0 };
  let expose = false;
  live.forEach(({ o, b }) => {
    if (!b.isConnected) return;
    const s = b.style;
    s.top = s.bottom = '';
    if (o.stripMode === 'fixed') {
      s[o.stripPosition] = `${off[o.stripPosition]}px`;
      off[o.stripPosition] += o.height;
    }
    expose = expose || o.exposeHeightVar;
  });
  const h = document.documentElement.style;
  if (expose) h.setProperty(VAR, `${off.top}px`);
  else if (exposed) h.removeProperty(VAR);
  exposed = expose;
};

export function createTextStrip(options: TextStripOptions): TextStrip {
  let o: ResolvedOptions = resolveOptions(options);
  if (typeof document === 'undefined') return inert();

  const key = () => (typeof o.rememberDismiss === 'string' ? o.rememberDismiss : '');
  if (key() && store(key())) return inert();

  const host = document.createElement('text-strip');
  host.setAttribute('data-text-strip', '');
  host.setAttribute('role', 'region');
  const root = host.attachShadow({ mode: 'open' });
  adopt(root);
  const sp = make('div', 'sp', root);
  const b = make('div', 'b', root);
  const t = make('div', 't', b);
  const set1 = make('div', 's', t);
  const set2 = make('div', 's', t);
  set2.setAttribute('aria-hidden', 'true');
  const btn = make('button', 'x', b, '×');
  btn.type = 'button';

  const me: Live = { o, b };
  live.push(me);
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let alive = true;
  let paused = false;
  let lastW = -1;
  let dur = 2e4;
  let placed = 0;
  let queued = false;
  let ro: ResizeObserver | undefined;

  const group = (hidden: boolean) => {
    const g = make('span', 'g');
    if (hidden) g.setAttribute('aria-hidden', 'true');
    o.textArray.forEach((text) => {
      make('span', 'i', g, text);
      if (o.separator) make('span', 'p', g, o.separator).setAttribute('aria-hidden', 'true');
    });
    return g;
  };

  const fill = (n: number) => {
    set1.textContent = set2.textContent = '';
    for (let i = 0; i < n; i++) {
      set1.appendChild(group(i > 0));
      set2.appendChild(group(true));
    }
  };

  const measure = (force?: boolean) => {
    if (!alive) return;
    const vw = b.clientWidth;
    if (vw && !force && vw === lastW) return;
    fill(1);
    const gw = (set1.firstChild as HTMLElement).getBoundingClientRect().width;
    // Hidden or detached: keep one group and measure again once the strip has a real size.
    lastW = vw && gw ? vw : -1;
    if (lastW < 0) return;
    fill(Math.ceil(vw / gw));
    // Keep the loop's progress when the duration changes, so resizes and updates do not jump back.
    const a = t.getAnimations?.()[0];
    const at = a ? (Number(a.currentTime) || 0) / dur : 0;
    dur = (set1.getBoundingClientRect().width / o.textSpeed) * 1e3;
    t.style.animationDuration = `${dur}ms`;
    if (a) a.currentTime = (at % 1) * dur;
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    const run = () => {
      queued = false;
      measure();
    };
    requestAnimationFrame(run);
  };

  const setTab = () => {
    if (o.respectReducedMotion && mq && mq.matches) b.tabIndex = 0;
    else b.removeAttribute('tabindex');
  };

  // Overlay strips are appended last with no box of their own; the others reserve space in the flow.
  const mount = () => {
    const body = document.body;
    if (!alive || !body) return;
    const fixed = o.stripMode === 'fixed';
    const overlay = fixed && !o.pushContent;
    const mt = o.mountTarget;
    const target = (overlay ? body : typeof mt === 'string' ? document.querySelector(mt) : mt) || body;
    host.toggleAttribute('data-o', overlay);
    sp.hidden = !fixed || overlay;
    sp.style.height = `${o.height}px`;
    const want = overlay || o.stripPosition === 'bottom' ? 2 : 1;
    // Moving a connected host drops focus inside it, so only insert when the place changes.
    if (host.parentNode !== target || placed !== want) {
      target.insertBefore(host, want > 1 ? null : target.firstChild);
      placed = want;
    }
    relayout();
  };

  const apply = () => {
    me.o = o;
    const s = b.style;
    s.height = `${o.height}px`;
    s.background = o.stripBgColor;
    s.color = o.textColor;
    s.fontSize = o.fontSize;
    s.fontFamily = o.fontFamily === 'inherit' ? '' : o.fontFamily;
    s.zIndex = o.stripMode === 'fixed' ? String(o.zIndex) : '';
    s.setProperty('--g', `${o.gap}px`);
    host.setAttribute('aria-label', o.ariaLabel);
    b.dir = o.dir;
    const cl = b.classList;
    cl.toggle('f', o.stripMode === 'fixed');
    cl.toggle('ph', o.pauseOnHover);
    cl.toggle('rm', o.respectReducedMotion);
    cl.toggle('c', o.closable);
    cl.toggle('paused', paused);
    btn.hidden = !o.closable;
    btn.setAttribute('aria-label', o.closeLabel);
    setTab();
    mount();
  };

  apply();
  measure(true);
  if (!document.body) {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        mount();
        measure(true);
      },
      { once: true },
    );
  }

  // ResizeObserver ships in every evergreen browser since 2020; the guard only protects other runtimes.
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(schedule);
    ro.observe(b);
  }
  mq?.addEventListener?.('change', setTab);
  // Font loading changes text widths without resizing the strip, so force a re-measure.
  document.fonts?.ready.then(() => {
    lastW = -1;
    schedule();
  });

  const inst: TextStrip = {
    element: host,
    update(p) {
      if (!alive) return;
      const defined = Object.fromEntries(Object.entries(p || {}).filter(([, v]) => v !== undefined));
      o = resolveOptions({ ...o, ...defined } as TextStripOptions);
      apply();
      measure(true);
    },
    pause() {
      paused = true;
      b.classList.add('paused');
    },
    play() {
      paused = false;
      b.classList.remove('paused');
    },
    destroy() {
      if (!alive) return;
      alive = false;
      ro?.disconnect();
      mq?.removeEventListener?.('change', setTab);
      host.remove();
      live.splice(live.indexOf(me), 1);
      relayout();
    },
  };

  btn.addEventListener('click', () => {
    if (key()) store(key(), true);
    inst.destroy();
    o.onClose?.();
  });

  return inst;
}
