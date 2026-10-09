# text-strip API reference

Full option list, instance methods and edge cases for text-strip 0.1. Source of truth: `src/options.ts`, `src/index.ts` and `src/strip.ts`.

## Exports

- `createTextStrip(options)`: creates one strip and returns an instance.
- `create`: alias of `createTextStrip`.
- `DEFAULTS`: the frozen default value of every option except `textArray`.
- Types: `TextStripOptions`, `TextItem`, `StripPosition`, `StripMode`, `TextDir`, `TextStrip`.

CDN build: `https://cdn.jsdelivr.net/npm/text-strip@0.1/dist/index.global.js` exposes `TextStrip.create` and `TextStrip.createTextStrip`.

## Types

```ts
type StripPosition = 'top' | 'bottom';
type StripMode = 'fixed' | 'overlay' | 'static';
type TextDir = 'ltr' | 'rtl' | 'auto';
type TextItem = string | { text: string; href: string };
```

## Options

Every option except `textArray` has a default. Invalid values throw `TextStrip: invalid <option>`.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `textArray` | `TextItem[]` | required | Texts to loop. Non-empty. Each string needs visible text. A link item needs non-blank `text` and a string `href`. |
| `stripBgColor` | string | `'#111111'` | Background color. |
| `textColor` | string | `'#ffffff'` | Text color. |
| `textSpeed` | number | `60` | Scroll speed in pixels per second. Must be finite and greater than 0. |
| `stripPosition` | `'top'` or `'bottom'` | `'top'` | Edge of the page. |
| `stripMode` | `'fixed'`, `'overlay'` or `'static'` | `'fixed'` | Placement mode. See the decision table in SKILL.md. |
| `mountTarget` | Element, CSS selector string or `null` | `null` (body) | Container for fixed and static modes. A selector that matches nothing uses body. Ignored in overlay mode. |
| `dir` | `'ltr'`, `'rtl'` or `'auto'` | `'auto'` | Text and scroll direction. `'auto'` follows the first strong letter of the texts. |
| `separator` | string | `'•'` | Character between items. `''` for none. |
| `gap` | number | `32` | Pixels on each side of the separator. Must be finite and 0 or more. |
| `height` | number | `40` | Strip height in pixels. Must be finite and greater than 0. |
| `fontSize` | string | `'14px'` | Any CSS font-size value. |
| `fontFamily` | string | `'inherit'` | Any CSS font-family value. |
| `pauseOnHover` | boolean | `true` | Pause while the pointer is over the strip. Keyboard focus inside the text always pauses. |
| `respectReducedMotion` | boolean | `true` | Stop scrolling under `prefers-reduced-motion: reduce`. The strip becomes a horizontal scroll area. |
| `closable` | boolean | `false` | Show a close button. Can change at runtime with `update()`. |
| `rememberDismiss` | `false` or string | `false` | localStorage key that stores a dismissal when the visitor closes the strip. `false` disables it. |
| `closeLabel` | string | `'Close'` | Accessible label of the close button. |
| `pauseButton` | boolean | `true` | Show the pause and play button. Hidden when texts fit, under reduced motion, or when `false`. |
| `pauseLabel` | string | `'Pause'` | Label of the pause button while playing. |
| `playLabel` | string | `'Play'` | Label of the play button while paused. |
| `exposeHeightVar` | boolean | `false` | Opt-in. Sets `--text-strip-height` on `:root` to the total height of the top fixed and overlay strips. Removed when no strip uses it. |
| `zIndex` | number | `9999` | Stacking order. Not used in static mode. |
| `ariaLabel` | string | `'Announcements'` | Accessible name of the region. |
| `onClose` | `() => void` | none | Called when the visitor closes the strip. Not called by `destroy()`. |

Only these options are validated: `textArray`, `textSpeed`, `height`, `gap`, `stripPosition`, `stripMode`, `mountTarget` and `dir`. Validation runs even without a document, so a server render reports a bad config.

## Instance

`createTextStrip` returns an object with:

| Member | Type | Behavior |
| --- | --- | --- |
| `element` | `HTMLElement` or `null` | The host element. `null` when no strip was created: no document, or a stored `rememberDismiss` dismissal. |
| `update(partial)` | method | Changes options and re-renders. Keys passed as `undefined` keep their value. Invalid values throw. The loop keeps its progress. No effect after `destroy()`. |
| `pause()` | method | Pauses scrolling and shows the play state. |
| `play()` | method | Resumes scrolling and shows the pause state. Overrides a visitor's pause. |
| `destroy()` | method | Removes the strip, its spacer and its listeners, and removes `--text-strip-height` unless another strip exposes it. Safe to call twice. |

Inert instance: when no strip is created, `element` is `null` and every method does nothing.

## Behavior notes

- Runtime changes that work with `update()`: `textArray`, `textSpeed`, `stripPosition`, `stripMode`, `dir`, `closable`, `pauseButton` and the visual options.
- Changing `rememberDismiss` with `update()` does not hide a strip that is already visible.
- Closing: the close button calls `destroy()`, stores the dismissal when `rememberDismiss` is set, then calls `onClose`.
- Stacking: fixed and overlay strips on the same side stack in creation order. Static strips do not stack.
- Two copies of the library on one page (CDN and npm) share one registry.
- Links: only `http:`, `https:`, `mailto:` and `tel:` become anchors. Other schemes render as plain text. Relative URLs resolve against the page base URL.

## Example

```js
import { createTextStrip } from 'text-strip';

const strip = createTextStrip({
  textArray: [
    'Free shipping on orders over $50',
    { text: 'Shipping policy', href: 'https://example.com/shipping' },
    'شحن مجاني للطلبات فوق 50 دولار',
  ],
  stripPosition: 'top',
  stripMode: 'fixed',
  closable: true,
  rememberDismiss: 'shipping-strip',
  onClose: () => console.log('closed'),
});

strip.update({ textSpeed: 90 });
strip.pause();
strip.play();
strip.destroy();
```
