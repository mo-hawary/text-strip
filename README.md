# text-strip

A drop-in, zero-dependency scrolling announcement strip for any website. LTR and RTL, Arabic-first.

Size: about 3 KB gzip (`npm run size` fails above 3 KB)

## Hero example

```js
import { createTextStrip } from 'text-strip';

createTextStrip({
  textArray: [
    'Free shipping on orders over $50',
    'شحن مجاني للطلبات فوق 50 دولار',
    'New arrivals every Friday',
    'وصول جديد كل جمعة',
  ],
  stripBgColor: '#111111',
  textColor: '#ffffff',
  stripPosition: 'top',
  closable: true,
  closeLabel: 'إغلاق',
});
```

## Install

With npm:

```sh
npm install text-strip
```

Or from a CDN, with no build step:

```html
<script src="https://cdn.jsdelivr.net/npm/text-strip"></script>
<script>
  TextStrip.create({ textArray: ['Free shipping this week', 'شحن مجاني هذا الأسبوع'] });
</script>
```

The CDN build is `dist/index.global.js` (the package's jsDelivr and unpkg entry). It exposes a `TextStrip` global with `TextStrip.create` and `TextStrip.createTextStrip`.

It is safe to load the script in `<head>`: the strip waits for `<body>` before it is inserted.

## Usage

ESM:

```js
import { createTextStrip } from 'text-strip';

const strip = createTextStrip({
  textArray: ['Free shipping this week', 'شحن مجاني هذا الأسبوع'],
});
```

CommonJS:

```js
const { createTextStrip } = require('text-strip');
```

`create` is also exported as an alias of `createTextStrip`.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `textArray` | `string[]` | (required) | Texts to loop, one or more. Arabic and English can be mixed. Inserted as plain text, never as HTML. |
| `stripBgColor` | `string` | `'#111111'` | Background color of the strip. |
| `textColor` | `string` | `'#ffffff'` | Text color. |
| `textSpeed` | `number` | `60` | Scroll speed in pixels per second. Must be greater than 0. |
| `stripPosition` | `'top' \| 'bottom'` | `'top'` | Place the strip at the top or bottom of the page. |
| `stripMode` | `'fixed' \| 'static'` | `'fixed'` | `'fixed'` stays on screen while the page scrolls. `'static'` sits in the normal page flow and scrolls away with the page. |
| `mountTarget` | `Element \| string \| null` | `null` (`<body>`) | Where the strip is inserted in static and fixed push modes. Accepts an element or a CSS selector, for example `'#site-header'` to put the strip inside a header. The strip goes in as the first child of the target (last child for `stripPosition: 'bottom'`). If the selector matches nothing, `<body>` is used. Overlay mode ignores it. |
| `dir` | `'ltr' \| 'rtl'` | `'ltr'` | Text direction and scroll direction. See RTL notes below. |
| `separator` | `string` | `'•'` | Character shown between items. Use `''` for none. |
| `gap` | `number` | `32` | Space in pixels on each side of the separator. |
| `height` | `number` | `40` | Strip height in pixels. |
| `fontSize` | `string` | `'14px'` | Any CSS font-size value. |
| `fontFamily` | `string` | `'inherit'` | Any CSS font-family value. Inherits the page font by default. |
| `pauseOnHover` | `boolean` | `true` | Pause scrolling on hover or when focus is inside the strip. |
| `respectReducedMotion` | `boolean` | `true` | Stop the scrolling when the user prefers reduced motion. The strip becomes horizontally scrollable instead. |
| `pushContent` | `boolean` | `true` | Fixed mode only: reserve space for the strip so it does not cover the page. Set to `false` for an overlay that takes no space. Has no effect in static mode, which always takes up space. |
| `closable` | `boolean` | `false` | Show a close button. Can be switched at runtime with `update()`. |
| `rememberDismiss` | `false \| string` | `false` | When closed, store a dismissal under this `localStorage` key so the strip stays hidden on later visits. `false` disables it. |
| `closeLabel` | `string` | `'Close'` | Accessible label of the close button, for example `'إغلاق'`. |
| `exposeHeightVar` | `boolean` | `false` | Opt-in. Sets `--text-strip-height` on `:root` to the total height of the fixed top strips. The variable is removed when no strip uses this option. See the sticky header recipe below. |
| `zIndex` | `number` | `9999` | Stacking order of the strip. |
| `ariaLabel` | `string` | `'Announcements'` | Accessible name of the region. |
| `onClose` | `() => void` | none | Called when the user closes the strip. |

## Instance API

`createTextStrip(options)` returns an instance with these members:

- `update(partial)`: change one or more options and re-render. Options passed as `undefined` keep their current value. The loop keeps its current progress (no jump back to the start), also when the window is resized. `stripPosition`, `stripMode`, `dir` and `closable` can all be switched at runtime.
- `pause()`: pause the scrolling.
- `play()`: resume the scrolling.
- `destroy()`: remove the strip, its spacer and its listeners. The `--text-strip-height` variable is removed too, unless another strip still exposes it. After `destroy()`, `update()` does nothing.
- `element`: the host element that holds the strip.

```js
const strip = createTextStrip({ textArray: ['Sale ends tonight', 'التخفيضات تنتهي الليلة'] });

strip.update({ textArray: ['New collection is live', 'المجموعة الجديدة متاحة الآن'], textSpeed: 90 });
strip.update({ stripPosition: 'bottom', closable: true });
strip.pause();
strip.play();
strip.destroy();
```

## RTL and bidi notes

- `dir: 'rtl'` scrolls the text from left to right, so Arabic reads naturally as it enters the screen.
- Each item is isolated for the bidi algorithm, so mixed Arabic and English text in one `textArray` keeps the word order of each item intact.

## Layout notes

Three layouts, picked with `stripMode` and `pushContent`:

| Layout | Options | Behavior |
|---|---|---|
| Fixed, pushes content (default) | `stripMode: 'fixed'` | Always visible. Reserves space so the strip does not cover your header or footer. |
| Fixed overlay | `stripMode: 'fixed', pushContent: false` | Always visible, floats over the page without taking space. |
| Static | `stripMode: 'static'` | Part of the page: takes space in the flow and scrolls away with it. |

- **Fixed, pushes content:** the strip's element is inserted as the first child of its target (the last child for `stripPosition: 'bottom'`). A spacer inside it takes the strip's height in the flow, so the page starts below the strip.
- **Overlay:** the strip is appended last to `<body>` and has no box of its own (`display: contents`), so grid and flex body layouts are not affected. As an element it still exists in the DOM, so selectors like `body > :last-child` or `:nth-last-child()` can match differently.
- **Static and push modes** occupy a place in the flow. On sites with `body { display: grid }`, use `mountTarget` to put the strip in a container you control, or use overlay mode.
- Multiple fixed strips on the same side stack automatically, in the order they were created.
- Elements with `position: fixed` or `position: sticky` on your site are not moved by the spacer.

### Sticky header recipe

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

### Overlay that does not move the page

```js
createTextStrip({ textArray: ['Limited offer'], pushContent: false, stripPosition: 'bottom' });
```

## CSS isolation

text-strip never changes your page styles, and your page styles cannot break it:

- It renders inside a Shadow DOM, so its CSS cannot leak out and your selectors cannot reach in.
- The host is a `<text-strip>` element with `all: initial !important`, which resets inherited and page styles on it. This beats even `!important` page rules aimed at the host.
- Only the page `font-family` is inherited (set `fontFamily` to override it). Weight, style, line-height and letter-spacing are not inherited.
- All colors and sizes are set inline inside the shadow root, so page CSS variables cannot leak in.
- It never edits `<body>`, `<html>` or your elements. The only exception is the opt-in `exposeHeightVar`, which sets one variable on `:root`.
- It works under a strict Content Security Policy (`style-src 'self'`). Styles are applied with constructable stylesheets; a `<style>` element is used only as a fallback in browsers without them.
- It works with Trusted Types: text is inserted with `textContent` and never through `innerHTML`.

## Known limits

- Static and push modes add one element to the target. Structural selectors on that container (such as `:first-child` or `:nth-child`) may match differently.
- A strip inside a transformed ancestor (for example a `mountTarget` with `transform` set) cannot be fixed to the viewport. This is a CSS limitation: `position: fixed` is relative to the transformed ancestor. Pick a target without a transform.

## Paste into Shopify

Open Online Store, then Themes, then Edit code. In `layout/theme.liquid`, paste the snippet directly before `</body>`:

```html
<script src="https://cdn.jsdelivr.net/npm/text-strip"></script>
<script>
  TextStrip.create({
    textArray: ['Free shipping on orders over $50', 'شحن مجاني للطلبات فوق 50 دولار'],
    stripPosition: 'top',
  });
</script>
```

## Paste into WordPress

Option 1: add a Custom HTML block with the same snippet as above. Option 2 (recommended for a site-wide strip): use a snippet plugin such as WPCode, create an HTML snippet, paste the same code, and set the location to site-wide footer. The footer option runs on every page.

## Framework snippets

React: create the strip in an effect and return its `destroy` as the cleanup.

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

Vue: create the strip in `onMounted` and destroy it in `onBeforeUnmount`.

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

## Accessibility

- The strip is a `role="region"` with the `ariaLabel` as its accessible name.
- The first copy of the texts is readable. The repeated copies used for the seamless loop are `aria-hidden="true"`.
- Scrolling pauses on hover and when focus is inside the strip, so links and the close button can be used.
- With `prefers-reduced-motion: reduce` and `respectReducedMotion` on (the default), the scrolling stops and the strip can be scrolled by hand.
- The close button is labeled with `closeLabel`.

## Browser support

Modern evergreen browsers: Chrome, Edge, Firefox and Safari. The strip uses Shadow DOM, constructable stylesheets, CSS custom properties and `ResizeObserver` (with a `resize` fallback).

## Development

```sh
npm install
npm run demo        # serves the demo at http://localhost:4173/demo/index.html
npm run check       # typecheck, unit tests, build and size check
```

## License

MIT. See [LICENSE](./LICENSE).
