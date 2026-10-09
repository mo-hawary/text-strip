import { resolveOptions } from './options';
import type { ResolvedOptions, TextItem, TextStripOptions } from './options';
import { styles } from './styles';

export interface TextStrip {
  element: HTMLElement | null;
  update(o: Partial<TextStripOptions>): void;
  pause(): void;
  play(): void;
  destroy(): void;
}

// First strong character decides: skip anything that is not a letter (digits, including Arabic-Indic, are weak).
const RTL = /^\P{L}*(?=\p{L})[\p{sc=Arab}\p{sc=Hebr}\p{sc=Syrc}\p{sc=Thaa}\p{sc=Nkoo}]/u;
// Shared through globalThis so two copies on one page (CDN and npm) still stack and share the height variable.
const reg: { l: { o: ResolvedOptions; b: HTMLElement }[]; e?: boolean } = ((globalThis as any)[
  Symbol.for('text-strip')
] ||= { l: [] });
const live = reg.l;
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

const txt = (x: TextItem) => (typeof x === 'string' ? x : x.text);

// Only web, mail and phone links become anchors; any other scheme falls back to plain text.
const safe = (href: string) => {
  if (!href.trim()) return '';
  try {
    const u = new URL(href, document.baseURI);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
};

// Stacks fixed and overlay strips that share a side and keeps the optional height variable in sync.
const relayout = () => {
  const off = { top: 0, bottom: 0 };
  let expose = false;
  live.forEach(({ o, b }) => {
    if (!b.isConnected) return;
    const s = b.style;
    s.top = s.bottom = '';
    if (o.stripMode !== 'static') {
      s[o.stripPosition] = `${off[o.stripPosition]}px`;
      off[o.stripPosition] += o.height;
    }
    expose = expose || o.exposeHeightVar;
  });
  const h = document.documentElement.style;
  if (expose) h.setProperty('--text-strip-height', `${off.top}px`);
  else if (reg.e) h.removeProperty('--text-strip-height');
  reg.e = expose;
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
  const w = make('div', 'w', b);
  const t = make('div', 't', w);
  const set1 = make('div', 's', t);
  const set2 = make('div', 's', t);
  set2.setAttribute('aria-hidden', 'true');
  const k = make('div', 'k', b);
  const pb = make('button', 'y', k);
  pb.type = 'button';
  const btn = make('button', 'x', k, '×');
  btn.type = 'button';

  const me = { o, b };
  live.push(me);
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let alive = true;
  let paused = false;
  let lastW = -1;
  let lastG = -1;
  let dur = 2e4;
  let placed = 0;
  let queued = false;
  let ro: ResizeObserver | undefined;

  const pad = <E extends HTMLElement>(e: E) => {
    e.style.padding = `0 ${o.gap / 2}px`;
    return e;
  };

  const group = (hidden: boolean) => {
    const g = make('span', 'g');
    if (hidden) g.setAttribute('aria-hidden', 'true');
    o.textArray.forEach((x) => {
      const href = typeof x === 'string' ? '' : safe(x.href);
      const e = make(href ? 'a' : 'span', 'i', g, txt(x));
      if (href) {
        e.setAttribute('href', href);
        // Copies hidden from assistive technology must not take focus either.
        if (hidden) e.tabIndex = -1;
      }
      pad(e);
      if (o.separator) pad(make('span', 'p', g, o.separator)).setAttribute('aria-hidden', 'true');
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

  // Loop progress as a 0 to 1 fraction, so a resize or update resumes at the same point.
  const progress = () => {
    const a = t.getAnimations?.()[0];
    return a ? ((Number(a.currentTime) || 0) / dur) % 1 : undefined;
  };

  const measure = (force?: boolean, at = progress()) => {
    if (!alive) return;
    const vw = b.clientWidth;
    const cur = set1.firstElementChild?.getBoundingClientRect().width;
    if (vw && !force && vw === lastW && cur === lastG) return;
    fill(1);
    const gw = (set1.firstElementChild as HTMLElement).getBoundingClientRect().width;
    // Hidden or detached: keep one group and measure again once the strip has a real size.
    lastW = vw && gw ? vw : -1;
    lastG = gw;
    if (lastW < 0) return;
    // A group that fits is shown alone and still, so the pause button (only for motion) is hidden.
    const fit = gw <= vw - k.offsetWidth + pb.offsetWidth;
    pb.hidden = fit || !o.pauseButton;
    b.classList.toggle('fit', fit);
    const n = Math.ceil(vw / gw);
    if (!fit) fill(n);
    // Same repeat count as the DOM, so hidden repeats under reduced motion do not change the duration.
    dur = ((n * gw) / o.textSpeed) * 1e3;
    t.style.animationDuration = `${dur}ms`;
    const a = t.getAnimations?.()[0];
    if (a) a.currentTime = (at || 0) * dur;
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      measure();
    });
  };

  const setTab = () => {
    if (o.respectReducedMotion && mq && mq.matches) w.tabIndex = 0;
    else w.removeAttribute('tabindex');
  };

  // Reduced motion changes the repeats and the tab stop, so both are re-checked.
  const onMotion = () => {
    setTab();
    lastW = -1;
    schedule();
  };

  const setPaused = (v: boolean) => {
    paused = v;
    b.classList.toggle('paused', v);
    pb.textContent = v ? '▶' : '❚❚';
    pb.setAttribute('aria-label', v ? o.playLabel : o.pauseLabel);
  };

  // Overlay strips are appended last with no box of their own; the others reserve space in the flow.
  const mount = () => {
    const body = document.body;
    if (!alive || !body) return;
    const ov = o.stripMode === 'overlay';
    const mt = o.mountTarget;
    const target = (ov ? body : typeof mt === 'string' ? document.querySelector(mt) : mt) || body;
    host.toggleAttribute('data-o', ov);
    sp.hidden = o.stripMode !== 'fixed';
    sp.style.height = `${o.height}px`;
    const want = ov || o.stripPosition === 'bottom' ? 2 : o.stripMode === 'static' ? 3 : 1;
    host.toggleAttribute('data-s', want > 2);
    // Moving a connected host drops focus inside it, so only insert when the place changes.
    if (host.parentNode !== target || placed !== want) {
      // Top strips keep creation order, and fixed spacers go before static strips so a fixed strip never covers one.
      let ref = target.firstElementChild;
      while (ref && ref !== host && ref.localName === 'text-strip' && (want > 1 || !ref.hasAttribute('data-s'))) {
        ref = ref.nextElementSibling;
      }
      target.insertBefore(host, want === 2 ? null : ref);
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
    s.fontFamily = o.fontFamily;
    s.zIndex = o.stripMode === 'static' ? '' : String(o.zIndex);
    host.setAttribute('aria-label', o.ariaLabel);
    // 'auto' follows the first strong directional character of the texts.
    const rtl = o.dir === 'auto' ? RTL.test(o.textArray.map(txt).join(' ')) : o.dir === 'rtl';
    b.dir = rtl ? 'rtl' : 'ltr';
    const cl = b.classList;
    cl.toggle('f', o.stripMode !== 'static');
    cl.toggle('ph', o.pauseOnHover);
    cl.toggle('rm', o.respectReducedMotion);
    btn.hidden = !o.closable;
    btn.setAttribute('aria-label', o.closeLabel);
    setPaused(paused);
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
  // The track is observed too, so typography changes re-measure.
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(schedule);
    ro.observe(b);
    ro.observe(t);
  }
  mq?.addEventListener?.('change', onMotion);
  // Font loading changes text widths without resizing the strip, so force a re-measure.
  document.fonts?.ready.then(() => {
    lastW = -1;
    schedule();
  });

  const inst: TextStrip = {
    element: host,
    update(p) {
      if (!alive) return;
      // Read the progress before apply(): a direction change swaps the animation object.
      const at = progress();
      o = resolveOptions(p, o);
      apply();
      measure(true, at);
    },
    pause: () => setPaused(true),
    play: () => setPaused(false),
    destroy() {
      if (!alive) return;
      alive = false;
      ro?.disconnect();
      mq?.removeEventListener?.('change', onMotion);
      host.remove();
      live.splice(live.indexOf(me), 1);
      relayout();
    },
  };

  pb.addEventListener('click', () => (paused ? inst.play() : inst.pause()));

  btn.addEventListener('click', () => {
    if (key()) store(key(), true);
    inst.destroy();
    o.onClose?.();
  });

  return inst;
}
