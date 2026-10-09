---
name: text-strip
description: Adds text-strip, a drop-in scrolling announcement bar (marquee, ticker, news ticker) to any website, with LTR and RTL Arabic support. Use when asked to add an announcement bar, scrolling text, marquee, ticker, banner, free shipping bar or promo strip, or an Arabic or RTL strip, on Shopify, WordPress, React, Next.js, Vue, Svelte or plain HTML, using the text-strip npm package or its CDN build.
license: MIT
metadata:
  author: Mohamed ElHawary
  version: "0.1.0"
---

# text-strip

text-strip renders a looping strip of texts. It is one call, has zero runtime dependencies, renders inside a Shadow DOM (it never changes host page styles), and supports LTR and RTL. Full option list: [references/api.md](references/api.md). Framework and platform snippets: [references/recipes.md](references/recipes.md).

## When to use

Use it for a site-wide announcement bar, promo or shipping banner, news ticker, or scrolling marquee. Use it for Arabic or RTL strips (`dir: 'auto'` handles them). Do not use it for a modal, a toast, or a notification that needs user action.

## Steps

1. Detect the framework: plain HTML, Shopify theme, WordPress, React, Next.js (App Router or Pages), Vue, Svelte, or other.
2. Install or load:
   - npm project: `npm install text-strip` (package page: https://www.npmjs.com/package/text-strip), then `import { createTextStrip } from 'text-strip';`
   - No build step, or a CMS: add the CDN script `https://cdn.jsdelivr.net/npm/text-strip@0.1/dist/index.global.js` and call `TextStrip.create(...)`. Pin `@0.1`.
3. Add the call in the right lifecycle place:
   - React and Next.js App Router: a client component (`'use client'`) that creates the strip in `useEffect` and returns `() => strip.destroy()`.
   - Vue: create in `onMounted`, call `strip?.destroy()` in `onBeforeUnmount`.
   - Svelte: create in `onMount` and return the cleanup.
   - Shopify: paste the CDN snippet in `layout/theme.liquid` before `</body>`.
   - WordPress: a Custom HTML block, or a snippet plugin with site-wide footer location.
   - Plain HTML: the snippet can sit in `<head>`, because the strip waits for body.
4. Choose options: `textArray` (required), colors, `stripPosition`, `stripMode` (table below), `dir`, and `closable` if visitors should dismiss it.
5. Verify in a browser: start the dev server or open the page, confirm the strip shows at the chosen top or bottom edge, scrolls, and (for Arabic) runs right to left. Check the pause button and, if used, the close button. Check the console for errors. Check that navigating away or unmounting leaves only one strip.

## Choosing stripMode

| Situation | Use | Why |
| --- | --- | --- |
| Strip must stay visible and the page must start below it | `'fixed'` (default) | Reserves space, so it does not cover the header. |
| Strip must stay visible but must not move the page | `'overlay'` | Floats over the page, takes no space. Ignores `mountTarget`. |
| Strip should scroll away with the page | `'static'` | Part of the page flow. Use `mountTarget` on grid body layouts. |

Add `exposeHeightVar: true` only when a sticky header must sit below a fixed or overlay top strip, and then add `top: var(--text-strip-height, 0)` to that header.

## The 8 most used options

| Option | Default | Notes |
| --- | --- | --- |
| `textArray` | required | Non-empty array of strings or `{ text, href }` links. |
| `stripBgColor` | `'#111111'` | Any CSS color. |
| `textColor` | `'#ffffff'` | Any CSS color. |
| `stripPosition` | `'top'` | `'top'` or `'bottom'`. |
| `stripMode` | `'fixed'` | `'fixed'`, `'overlay'` or `'static'`. |
| `dir` | `'auto'` | `'auto'`, `'ltr'` or `'rtl'`. |
| `closable` | `false` | Shows a close button. Pair with `rememberDismiss` to hide it on later visits. |
| `textSpeed` | `60` | Pixels per second. Must be greater than 0. |

## Examples

React or Next.js App Router (client component):

```jsx
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

Plain HTML with the CDN build:

```html
<script src="https://cdn.jsdelivr.net/npm/text-strip@0.1/dist/index.global.js"></script>
<script>
  TextStrip.create({
    textArray: ['Free shipping on orders over $50', 'Summer sale is live'],
    stripBgColor: '#0D1117',
    textColor: '#F59E0B',
  });
</script>
```

Arabic RTL store strip with translated labels:

```js
createTextStrip({
  textArray: ['شحن مجاني لكل الطلبات', 'وصول جديد كل جمعة'],
  dir: 'auto',
  closable: true,
  closeLabel: 'إغلاق',
  pauseLabel: 'إيقاف مؤقت',
  playLabel: 'تشغيل',
});
```

## Edge cases

- Do not call `play()` on a timer. It overrides the visitor's pause. Call it only when the visitor asks to resume.
- `strip.element` is `null` when a stored `rememberDismiss` dismissal exists, and also when there is no document. Use `strip.element?.`.
- `textArray` must be non-empty. Each string needs visible text. Each link needs non-blank `text` and a string `href`.
- `textSpeed`, `height` and `gap` must be real numbers, not strings. `textSpeed` and `height` must be greater than 0. `gap` must be 0 or more.
- Only `http:`, `https:`, `mailto:` and `tel:` links become anchors. Other schemes render as plain text.
- Invalid options throw `TextStrip: invalid <option>`, also during server rendering.
- In React Strict Mode the effect runs twice in development. The cleanup destroys the first instance, so this is fine.
- `onClose` runs only when the visitor clicks close, not on `destroy()`.
- `update(partial)` changes options at runtime. Options passed as `undefined` keep their value.
- Do not put the strip inside a container with a CSS `transform`, because fixed positioning breaks there.
