# text-strip recipes

Framework and platform recipes. Each one creates the strip once in the browser and cleans it up when the page or component goes away. Options are described in `api.md`.

## Plain HTML (CDN, no build step)

Put this before `</body>`, or in `<head>` (the strip waits for body):

```html
<script src="https://cdn.jsdelivr.net/npm/text-strip@0.1/dist/index.global.js"></script>
<script>
  TextStrip.create({ textArray: ['Free shipping this week', 'شحن مجاني هذا الأسبوع'] });
</script>
```

Pin `@0.1` on live sites, so only patch releases reach the page.

## React

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

React Strict Mode runs effects twice in development. This is fine: the cleanup destroys the first instance before the second one is created.

## Next.js (App Router)

The strip needs the browser. Put it in a client component and render it from the layout.

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

## Next.js (Pages Router)

Use the same client component in `pages/_app.jsx`, rendered before `<Component />`. The effect runs only in the browser.

## Vue

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

## Svelte

```svelte
<script>
  import { onMount } from 'svelte';
  import { createTextStrip } from 'text-strip';

  onMount(() => {
    const strip = createTextStrip({ textArray: ['Free shipping this week', 'شحن مجاني هذا الأسبوع'] });
    return () => strip.destroy();
  });
</script>
```

## Shopify

In the Shopify admin, open Online Store, then Themes, then Edit code. In `layout/theme.liquid`, paste this directly before `</body>`:

```html
<script src="https://cdn.jsdelivr.net/npm/text-strip@0.1/dist/index.global.js"></script>
<script>
  TextStrip.create({
    textArray: ['Free shipping on orders over $50', 'شحن مجاني للطلبات فوق 50 دولار'],
    stripPosition: 'top',
  });
</script>
```

## WordPress

- Option 1: add a Custom HTML block with the plain HTML snippet above.
- Option 2 (recommended for a site-wide strip): install a snippet plugin such as WPCode, create an HTML snippet with the same code, and set its location to site-wide footer. The footer location runs on every page.

## Arabic store strip

Arabic first, with `dir` left on `'auto'`. The first strong letter decides the direction, so an Arabic first item starts the strip right to left.

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

## Link items

```js
createTextStrip({
  textArray: [
    { text: 'Shipping policy', href: 'https://example.com/shipping' },
    { text: 'Call us: 0100 000 0000', href: 'tel:+201000000000' },
    'شحن مجاني للطلبات فوق 50 دولار',
  ],
});
```

Only `http:`, `https:`, `mailto:` and `tel:` become links. Other schemes render as plain text.

## Stacked strips

Fixed and overlay strips on the same side stack automatically, in creation order:

```js
createTextStrip({ textArray: ['Free shipping on orders over $50'] });
createTextStrip({ textArray: ['Limited offer'], stripBgColor: '#7c2d12' });
```

## Overlay that does not move the page

```js
createTextStrip({ textArray: ['Limited offer'], stripMode: 'overlay', stripPosition: 'bottom' });
```

## Sticky header offset with exposeHeightVar

Set `exposeHeightVar: true` on the strip, then offset the sticky header with the variable:

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

## Strip inside a container

Use `mountTarget` to put a fixed or static strip inside an element you control. Pick a target without a CSS `transform`, because a transformed ancestor cannot be fixed to the viewport.

```js
createTextStrip({ textArray: ['Free returns'], mountTarget: '#site-header' });
```

If the selector matches nothing, the strip goes into body.

In a flex row, give the mount target a width (for example `flex: 1`), because the strip has no intrinsic width of its own.

## Remembered dismissal

```js
const strip = createTextStrip({
  textArray: ['Sale ends tonight'],
  closable: true,
  rememberDismiss: 'sale-strip',
  onClose: () => console.log('closed'),
});

strip.element?.setAttribute('data-campaign', 'summer');
```

After the visitor closes the strip, later calls with the same key return an inert instance, so `element` is `null`. Always use `strip.element?.`.
