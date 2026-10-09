<p align="center">
  <img src="./assets/banner.svg" alt="text-strip: scrolling announcement bar" width="100%">
</p>

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Poppins&weight=700&size=22&duration=2600&pause=700&color=F59E0B&center=true&vCenter=true&width=1000&lines=One+config+object.+Any+website.;LTR+and+RTL%2C+Arabic-first;Shadow+DOM+isolated.+CSP+safe.;Zero+dependencies.+About+4+KB+gzip." alt="One config object. Any website. LTR and RTL, Arabic-first. Shadow DOM isolated. CSP safe. Zero dependencies. About 4 KB gzip.">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/text-strip"><img src="https://img.shields.io/npm/v/text-strip?style=for-the-badge&labelColor=0D1117&color=F59E0B" alt="npm version"></a>
  <a href="https://github.com/mo-hawary/text-strip/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/mo-hawary/text-strip/ci.yml?branch=main&style=for-the-badge&labelColor=0D1117&label=CI" alt="CI"></a>
  <a href="https://bundlejs.com/?q=text-strip"><img src="https://img.shields.io/badge/gzip-about%204%20KB-F59E0B?style=for-the-badge&labelColor=0D1117" alt="gzip about 4 KB"></a>
  <a href="https://www.npmjs.com/package/text-strip?activeTab=dependencies"><img src="https://img.shields.io/badge/dependencies-zero-F59E0B?style=for-the-badge&labelColor=0D1117" alt="zero dependencies"></a>
  <a href="./src/options.ts"><img src="https://img.shields.io/badge/TypeScript-typed-F59E0B?style=for-the-badge&labelColor=0D1117&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="#rtl-and-bidi-notes"><img src="https://img.shields.io/badge/RTL-ready-F59E0B?style=for-the-badge&labelColor=0D1117" alt="RTL ready"></a>
  <a href="#accessibility"><img src="https://img.shields.io/badge/WCAG%202.2-pause%20control-F59E0B?style=for-the-badge&labelColor=0D1117" alt="WCAG 2.2 pause control"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-F59E0B?style=for-the-badge&labelColor=0D1117" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://mo-hawary.github.io/text-strip/"><strong>Live demo</strong></a> &nbsp;·&nbsp;
  <a href="https://www.npmjs.com/package/text-strip"><strong>npm</strong></a> &nbsp;·&nbsp;
  <a href="README.ar.md"><strong>العربية</strong></a> &nbsp;·&nbsp;
  <a href="./CHANGELOG.md"><strong>Changelog</strong></a> &nbsp;·&nbsp;
  <a href="./CONTRIBUTING.md"><strong>Contributing</strong></a> &nbsp;·&nbsp;
  <a href="./SECURITY.md"><strong>Security</strong></a>
</p>

<p align="center">
  <img src="docs/preview.gif" alt="text-strip preview: an amber English strip and an Arabic strip scrolling in opposite directions" width="100%">
</p>

---

## Why text-strip

A store needs a "free shipping" bar in Arabic and English. Adding it should not mean an app, a theme rewrite, or a widget that fights the site's CSS. text-strip is one script and one config object. It draws the bar in its own Shadow DOM, sets the direction from the text, and leaves the rest of the page alone.

- **One config object.** Pass a list of texts and a few options. The same call works in a bundler, in a plain `<script>` tag, and in Shopify or WordPress.
- **Arabic-first RTL.** `dir: 'auto'` reads the first strong character and picks the scroll direction. Each item is bidi-isolated, so mixed Arabic and English items keep their word order.
- **Isolated both ways.** Shadow DOM keeps page styles out of the strip and the strip's styles out of the page. It works under a strict CSP and with Trusted Types, because text is never inserted as HTML.
- **Accessible.** A visible pause button, reduced-motion support, keyboard operable controls, and a focus pause for links inside the moving text.
- **Tiny.** Zero dependencies and about 4 KB gzip (ESM 3.8 KB, CDN 4.0 KB).

## Quick start

With npm:

```sh
npm install text-strip
```

Published on npm: [text-strip](https://www.npmjs.com/package/text-strip).

```js
import { createTextStrip } from 'text-strip';

const strip = createTextStrip({
  textArray: ['Free shipping on orders over $50', 'شحن مجاني للطلبات فوق 50 دولار'],
  stripBgColor: '#111111',
  textColor: '#ffffff',
  closable: true,
  closeLabel: 'Close',
});
```

CommonJS works too: `const { createTextStrip } = require('text-strip');`. `create` is also exported as an alias of `createTextStrip`.

From a CDN, with no build step:

```html
<script src="https://cdn.jsdelivr.net/npm/text-strip@0.1/dist/index.global.js"></script>
<script>
  TextStrip.create({ textArray: ['Free shipping this week', 'شحن مجاني هذا الأسبوع'] });
</script>
```

The CDN build is `dist/index.global.js`. It exposes a `TextStrip` global with `TextStrip.create` and `TextStrip.createTextStrip`.

> **Tip:** pin the major and minor version in the CDN URL (`@0.1`) on live sites. The URL then picks up only `0.1.x` patch releases, so a future release cannot change a live store under you. Breaking changes ship in a new minor version (`0.2`), and you move to it on purpose after testing.

It is safe to load the script in `<head>`: the strip waits for `<body>` before it is inserted.

## Recipes

<details>
<summary><strong>Shopify</strong></summary>

Open Online Store, then Themes, then Edit code. In `layout/theme.liquid`, paste the snippet directly before `</body>`:

```html
<script src="https://cdn.jsdelivr.net/npm/text-strip@0.1/dist/index.global.js"></script>
<script>
  TextStrip.create({
    textArray: ['Free shipping on orders over $50', 'شحن مجاني للطلبات فوق 50 دولار'],
    stripPosition: 'top',
  });
</script>
```

</details>

<details>
<summary><strong>WordPress</strong></summary>

- **Option 1:** add a Custom HTML block with the same snippet as the CDN example above.
- **Option 2 (recommended for a site-wide strip):** use a snippet plugin such as WPCode, create an HTML snippet, paste the same code, and set the location to site-wide footer. The footer option runs on every page.

</details>

<details>
<summary><strong>React</strong></summary>

Create the strip in an effect and return its `destroy` as the cleanup.

```jsx
import { useEffect } from 'react';
import { createTextStrip } from 'text-strip';

export function AnnouncementStrip() {
  useEffect(() => {
    const strip = createTextStrip({ textArray: ['Free shipping this week', 'شحن مجاني هذا الأسبوع'] });
    return () => strip.destroy();
  }, []);

  return null;
}
```

</details>

<details>
<summary><strong>Next.js (App Router)</strong></summary>

Put the strip in a client component, then render it from your layout. The effect runs only in the browser.

```jsx
// app/announcement-strip.jsx
'use client';

import { useEffect } from 'react';
import { createTextStrip } from 'text-strip';

export default function AnnouncementStrip() {
  useEffect(() => {
    const strip = createTextStrip({ textArray: ['Free shipping this week', 'شحن مجاني هذا الأسبوع'] });
    return () => strip.destroy();
  }, []);

  return null;
}
```

```jsx
// app/layout.jsx
import AnnouncementStrip from './announcement-strip';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AnnouncementStrip />
        {children}
      </body>
    </html>
  );
}
```

</details>

<details>
<summary><strong>Vue</strong></summary>

Create the strip in `onMounted` and destroy it in `onBeforeUnmount`.

```vue
<script setup>
import { onBeforeUnmount, onMounted } from 'vue';
import { createTextStrip } from 'text-strip';

let strip;

onMounted(() => {
  strip = createTextStrip({ textArray: ['Free shipping this week', 'شحن مجاني هذا الأسبوع'] });
});

onBeforeUnmount(() => {
  strip?.destroy();
});
</script>
```

</details>

<details>
<summary><strong>Arabic store strip</strong></summary>

Arabic first, with the direction left on `'auto'`. The first strong character decides the direction, so an Arabic first item starts the strip right to left.

```js
createTextStrip({
  textArray: ['شحن مجاني لكل الطلبات', 'وصول جديد كل جمعة', 'New arrivals every Friday'],
  stripBgColor: '#0D1117',
  textColor: '#F59E0B',
  closable: true,
  closeLabel: 'إغلاق',
  pauseLabel: 'إيقاف مؤقت',
  playLabel: 'تشغيل',
});
```

</details>

<details>
<summary><strong>Link items</strong></summary>

Use a `{ text, href }` object in `textArray` to make an item a link:

```js
createTextStrip({
  textArray: [
    { text: 'Shipping policy', href: 'https://example.com/shipping' },
    { text: 'Call us: 0100 000 0000', href: 'tel:+201000000000' },
    'شحن مجاني للطلبات فوق 50 دولار',
  ],
});
```

Only `http:`, `https:`, `mailto:` and `tel:` URLs become anchors. Any other scheme, such as `javascript:`, is rendered as plain text and is never linked. Relative URLs resolve against the page's base URL.

</details>

<details>
<summary><strong>Multiple stacked strips</strong></summary>

Fixed and overlay strips on the same side stack automatically, in the order they were created.

```js
createTextStrip({ textArray: ['Free shipping on orders over $50'] });
createTextStrip({ textArray: ['Limited offer'], stripBgColor: '#7c2d12' });
```

</details>

<details>
<summary><strong>Sticky header offset with <code>exposeHeightVar</code></strong></summary>

Set `exposeHeightVar: true` on the strip, then offset your sticky header with the variable:

```js
createTextStrip({
  textArray: ['Free shipping on orders over $50', 'شحن مجاني للطلبات فوق 50 دولار'],
  exposeHeightVar: true,
});
```

```css
header.sticky {
  top: var(--text-strip-height, 0);
}
```

</details>

## Options

The six options most sites change:

| Option | Default | Description |
| --- | --- | --- |
| `textArray` | (required) | Texts to loop. Strings, or `{ text, href }` links. Mixed Arabic and English is fine. |
| `stripBgColor` | `'#111111'` | Background color of the strip. |
| `textColor` | `'#ffffff'` | Text color. |
| `stripPosition` | `'top'` | `'top'` or `'bottom'` of the page. |
| `stripMode` | `'fixed'` | `'fixed'`, `'overlay'` or `'static'`. See [Layout modes](#layout-modes). |
| `dir` | `'auto'` | `'auto'`, `'ltr'` or `'rtl'`. See [RTL and bidi notes](#rtl-and-bidi-notes). |

<details>
<summary><strong>All options</strong></summary>

Invalid values throw an error that names the option, for example `TextStrip: invalid stripMode`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `textArray` | `Array<string \| { text: string; href: string }>` | (required) | Texts to loop, one or more. Arabic and English can be mixed. Each text is inserted as plain text, never as HTML. A `{ text, href }` item is a link, but only for `http:`, `https:`, `mailto:` and `tel:` URLs. Other schemes render as plain text. |
| `stripBgColor` | `string` | `'#111111'` | Background color of the strip. |
| `textColor` | `string` | `'#ffffff'` | Text color. |
| `textSpeed` | `number` | `60` | Scroll speed in pixels per second. Must be greater than 0. |
| `stripPosition` | `'top' \| 'bottom'` | `'top'` | Place the strip at the top or bottom of the page. |
| `stripMode` | `'fixed' \| 'overlay' \| 'static'` | `'fixed'` | How the strip sits on the page. `'fixed'` stays on screen and reserves space. `'overlay'` stays on screen and takes no space. `'static'` is part of the page flow and scrolls away with the page. See Layout notes. |
| `mountTarget` | `Element \| string \| null` | `null` (`<body>`) | Where the strip is inserted in `'fixed'` and `'static'` modes. Accepts an element or a CSS selector, for example `'#site-header'` to put the strip inside a header. The strip goes in as the first child of the target (last child for `stripPosition: 'bottom'`). If the selector matches nothing, `<body>` is used. Overlay mode ignores it. |
| `dir` | `'ltr' \| 'rtl' \| 'auto'` | `'auto'` | Text direction and scroll direction. `'auto'` follows the first strong character of the texts: Arabic or Hebrew means RTL, a Latin letter means LTR. See RTL notes below. |
| `separator` | `string` | `'•'` | Character shown between items. Use `''` for none. |
| `gap` | `number` | `32` | Space in pixels on each side of the separator. |
| `height` | `number` | `40` | Strip height in pixels. Must be greater than 0. |
| `fontSize` | `string` | `'14px'` | Any CSS font-size value. |
| `fontFamily` | `string` | `'inherit'` | Any CSS font-family value. Inherits the page font by default. |
| `pauseOnHover` | `boolean` | `true` | Pause scrolling while the pointer is over the strip. Keyboard focus inside the moving text always pauses it, whatever this option is set to. |
| `respectReducedMotion` | `boolean` | `true` | Stop the scrolling when the user prefers reduced motion. The strip becomes horizontally scrollable instead. |
| `closable` | `boolean` | `false` | Show a close button. Can be switched at runtime with `update()`. |
| `rememberDismiss` | `false \| string` | `false` | When closed, store a dismissal under this `localStorage` key so the strip stays hidden on later visits. `false` disables it. A stored dismissal makes `createTextStrip` return an instance with `element: null`. |
| `closeLabel` | `string` | `'Close'` | Accessible label of the close button, for example `'إغلاق'`. |
| `pauseButton` | `boolean` | `true` | Show a pause and play button while the texts scroll. It is hidden when the texts fit, under reduced motion, or when set to `false`. |
| `pauseLabel` | `string` | `'Pause'` | Accessible label of the pause button while the strip is playing, for example `'إيقاف مؤقت'`. |
| `playLabel` | `string` | `'Play'` | Accessible label of the play button while the strip is paused, for example `'تشغيل'`. |
| `exposeHeightVar` | `boolean` | `false` | Opt-in. Sets `--text-strip-height` on `:root` to the total height of the top `'fixed'` and `'overlay'` strips. The variable is removed when no strip uses this option. See the sticky header recipe above. |
| `zIndex` | `number` | `9999` | Stacking order of the strip. Not used in static mode. |
| `ariaLabel` | `string` | `'Announcements'` | Accessible name of the region. |
| `onClose` | `() => void` | none | Called when the user closes the strip. |

</details>

## Instance API

`createTextStrip(options)` returns an instance with these members:

| Member | Description |
| --- | --- |
| `update(partial)` | Change one or more options and re-render. Options passed as `undefined` keep their current value. The loop keeps its current progress (no jump back to the start), also when the window is resized. `stripPosition`, `stripMode`, `dir`, `closable` and `pauseButton` can all be switched at runtime. |
| `pause()` | Pause the scrolling. The button shows the play state. |
| `play()` | Resume the scrolling. |
| `destroy()` | Remove the strip, its spacer and its listeners. The `--text-strip-height` variable is removed too, unless another strip still exposes it. After `destroy()`, `update()` does nothing. |
| `element` | The host element that holds the strip. It is `null` when the strip was not created, for example after a stored `rememberDismiss` dismissal. See Known limits. |

```js
const strip = createTextStrip({ textArray: ['Sale ends tonight', 'التخفيضات تنتهي الليلة'] });

strip.update({ textArray: ['New collection is live', 'المجموعة الجديدة متاحة الآن'], textSpeed: 90 });
strip.update({ stripPosition: 'bottom', closable: true });
strip.pause();
strip.play();
strip.destroy();
```

## RTL and bidi notes

- **`dir: 'auto'` (default):** reads the first strong character of the texts, in order. Arabic and Hebrew start the strip right to left, and a Latin letter starts it left to right. Neutral characters such as digits, emoji and punctuation do not decide the direction.
- **`dir: 'rtl'`:** scrolls the text from left to right, so Arabic reads naturally as it enters the screen.
- **Bidi isolation:** each item is isolated for the bidi algorithm, so mixed Arabic and English text in one `textArray` keeps the word order of each item intact.

## Layout modes

Three modes, picked with `stripMode`:

| Mode | Option | Behavior |
| --- | --- | --- |
| **Fixed** (default) | `stripMode: 'fixed'` | Always visible. Reserves space so the strip does not cover your header or footer. |
| **Overlay** | `stripMode: 'overlay'` | Always visible, floats over the page without taking space. `mountTarget` is ignored. |
| **Static** | `stripMode: 'static'` | Part of the page: takes space in the flow and scrolls away with it. |

- **Fixed:** the strip's element is inserted as the first child of its target (the last child for `stripPosition: 'bottom'`). A spacer inside it takes the strip's height in the flow, so the page starts below the strip.
- **Overlay:** the strip is appended last to `<body>` and has no box of its own (`display: contents`), so grid and flex body layouts are not affected. The bar itself is fixed to the viewport. As an element it still exists in the DOM, so selectors like `body > :last-child` or `:nth-last-child()` can match differently.
- **Static:** occupies a place in the flow. On sites with `body { display: grid }`, use `mountTarget` to put the strip in a container you control, or use overlay mode.
- **Stacking:** fixed and overlay strips on the same side stack automatically, in the order they were created. Static strips do not stack. A static top strip is never covered by a fixed top strip, because fixed strips reserve their space first and the static strip comes after them in the flow.
- **Shared registry:** two copies of the library on one page (for example the CDN build and the npm package) share one registry, so stacking and `exposeHeightVar` still work across both.
- **Fit:** when all texts fit in the strip, they are shown centered and still, without scrolling. The pause button is hidden in that case, because there is no motion to pause.
- **Spacer:** elements with `position: fixed` or `position: sticky` on your site are not moved by the spacer.

### Overlay that does not move the page

```js
createTextStrip({ textArray: ['Limited offer'], stripMode: 'overlay', stripPosition: 'bottom' });
```

## Accessibility

- **Region:** the strip is a `role="region"` with the `ariaLabel` as its accessible name.
- **Pause control:** a visible pause button (`pauseButton`, on by default) appears while the texts scroll. It covers the pause requirement of WCAG 2.2.2 (Pause, Stop, Hide) for moving content. Its label switches between `pauseLabel` and `playLabel`.
- **Native buttons:** the pause and close buttons are native `<button>` elements. They are keyboard operable with Tab, Enter and Space, and they show a visible focus outline.
- **Translatable labels:** `ariaLabel`, `pauseLabel`, `playLabel` and `closeLabel` are plain text options, so you can translate them.
- **Reading order:** the first copy of the texts is readable. The repeated copies used for the seamless loop are `aria-hidden="true"`, and their links are not focusable (`tabindex="-1"`), so keyboard users reach each link once.
- **Pausing:** scrolling pauses on hover when `pauseOnHover` is true, and always while keyboard focus is inside the moving text (for example on a link), so the link can be used. The pause and close buttons never move with the text.
- **Integrators:** `strip.play()` overrides a visitor's pause. Do not call `play()` on a timer or in a loop. Respect the visitor's choice, and call `play()` only when the visitor asks to resume.
- **Reduced motion:** with `prefers-reduced-motion: reduce` and `respectReducedMotion` on (the default), the scrolling stops, the repeated copies and the pause button are hidden, and the strip becomes a focusable horizontal scroll area that can be scrolled by hand or with the keyboard.

## CSS isolation

text-strip never changes your page styles, and your page styles cannot break it:

- It renders inside a Shadow DOM, so its CSS cannot leak out and your selectors cannot reach in.
- The host is a `<text-strip>` element with `all: initial !important`, which resets inherited and page styles on it. This beats even `!important` page rules aimed at the host.
- The host's `::before` and `::after` pseudo-elements are neutralized (`content: none` and `display: none`), so page rules cannot add content or boxes to the strip.
- No CSS custom properties are read inside the shadow tree. Variables and `@property` registrations on your page cannot change the strip.
- Only the page `font-family` is inherited (set `fontFamily` to override it). Weight, style, line-height and letter-spacing are not inherited.
- All colors and sizes are set as inline styles on shadow elements through the CSSOM.
- It never changes the styles or attributes of `<body>`, `<html>` or your elements. The only exception is the opt-in `exposeHeightVar`, which sets one variable on `:root`.
- It works under a strict Content Security Policy such as `style-src 'self'`. Styles are applied with constructable stylesheets, which current browsers accept under that policy. Only browsers without constructable stylesheets (Safari before 16.4) fall back to an inline `<style>` element. A strict policy blocks that element unless `'unsafe-inline'` is allowed for styles. The strip does not add a nonce to the fallback element, so a nonce-only policy does not cover it.
- It works with Trusted Types: text is inserted with `textContent` and never through `innerHTML`.

## Browser support

Modern evergreen browsers: Chrome, Edge, Firefox and Safari. The strip uses Shadow DOM, constructable stylesheets (with a `<style>` fallback for Safari before 16.4) and `ResizeObserver`.

## Known limits

- **Structure:** fixed and static modes add one element to the target. Structural selectors on that container (such as `:first-child` or `:nth-child`) may match differently.
- **Overlay:** overlay mode adds one element as the last child of `<body>`.
- **Transforms:** a strip inside a transformed ancestor (for example a `mountTarget` with `transform` set) cannot be fixed to the viewport. This is a CSS limitation: `position: fixed` is relative to the transformed ancestor. Pick a target without a transform.
- **Stored dismissal:** after a visitor closes a strip with `rememberDismiss`, later `createTextStrip` calls with the same key return an inert instance whose `element` is `null`. Integrator code must not assume that `strip.element` exists:

  ```js
  const strip = createTextStrip({ textArray: ['Sale ends tonight'], closable: true, rememberDismiss: 'sale-strip' });
  strip.element?.setAttribute('data-campaign', 'summer');
  ```

- **Runtime `rememberDismiss`:** changing `rememberDismiss` at runtime with `update()` does not hide a strip that is already visible.
- **Focus on links:** keyboard focus on a link that has scrolled out of view cannot scroll it back into view while the loop runs. The loop pauses on focus, but the strip's clipped box does not scroll to reveal the link. With `prefers-reduced-motion: reduce` the strip is a scroll area, so the link can be reached there.

## Project structure

The library source is in `src/`. Each module has one job:

- `index.ts`: public exports (`createTextStrip`, its `create` alias, `DEFAULTS` and the public types).
- `options.ts`: public types, defaults, and validation of caller options.
- `styles.ts`: the shadow CSS as one string, kept in cascade order.
- `dom.ts`: element helpers and stylesheet adoption into the shadow root.
- `text.ts`: direction detection, text of an item, and safe link checks.
- `storage.ts`: remembered dismissal in `localStorage`.
- `registry.ts`: shared stacking registry and the `--text-strip-height` variable.
- `render.ts`: the shadow tree, its copies, and painting of options and state.
- `loop.ts`: measuring, fit, lap timing and progress.
- `mount.ts`: placement of the host on the page.
- `strip.ts`: `createTextStrip`, the orchestrator that wires the modules together.

## Using text-strip with AI agents

- Give your agent this link, and it learns how to use text-strip: https://mo-hawary.github.io/text-strip/llms.txt. For the full reference in one file, use https://mo-hawary.github.io/text-strip/llms-full.txt.
- Install the agent skill with `npx skills add mo-hawary/text-strip`. It works with Claude Code, Codex, Cursor, Copilot and other agents. If your GitHub CLI supports it, `gh skill install mo-hawary/text-strip` does the same.
- Contributors: agents that work on this repo read [AGENTS.md](./AGENTS.md).

## Contributing

Bug reports, feature ideas and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for community expectations.

```sh
npm install
npm run demo        # builds, then serves the demo at http://localhost:4173/demo/index.html
npm run check       # typecheck, unit tests, build and size check
```

The live demo is at https://mo-hawary.github.io/text-strip/. To run it locally, use `npm run demo`. The server uses port 4173 by default; set `PORT` to change it.

## Security

To report a vulnerability, follow the steps in [SECURITY.md](./SECURITY.md). Please do not open a public issue for security problems.

## Author & contact

Created and maintained by **Mohamed ElHawary**. For questions, collaboration or hiring, reach out on [LinkedIn](https://www.linkedin.com/in/mohawary). Bugs and feature requests go to [GitHub issues](https://github.com/mo-hawary/text-strip/issues); security reports go through [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE). Release notes for each version are in [CHANGELOG.md](./CHANGELOG.md).

---

<p align="center">
  Built by <a href="https://mohawary.com"><strong>Mohamed ElHawary</strong></a>
</p>

<p align="center">
  <a href="https://mohawary.com"><img src="https://img.shields.io/badge/Website-mohawary.com-F59E0B?style=for-the-badge&labelColor=0D1117" alt="Website: mohawary.com"></a>
  <a href="https://github.com/mo-hawary"><img src="https://img.shields.io/badge/GitHub-mo--hawary-F59E0B?style=for-the-badge&labelColor=0D1117&logo=github&logoColor=white" alt="GitHub: mo-hawary"></a>
  <a href="https://www.linkedin.com/in/mohawary"><img src="https://img.shields.io/badge/LinkedIn-Mohamed%20ElHawary-2563EB?style=for-the-badge&logo=linkedin&logoColor=white&labelColor=0D1117" alt="LinkedIn" /></a>
</p>
