# text-strip

text-strip is a drop-in scrolling announcement bar for any website. It takes one config object and a list of texts, supports LTR and RTL with Arabic-first text handling, draws itself inside a Shadow DOM so page CSS cannot break it and it cannot leak styles into the page, and has zero dependencies. The gzip bundle is about 4 KB.

Live showcase: https://mo-hawary.github.io/text-strip/

Canonical documentation: https://mohawary.com/open-source/text-strip

## Install

With npm, for a bundler project:

```sh
npm install text-strip
```

Published on npm: [text-strip](https://www.npmjs.com/package/text-strip).

With a script tag, for a plain page. Pin the minor version (`@0.1`) on live sites:

```html
<script src="https://cdn.jsdelivr.net/npm/text-strip@0.1/dist/index.global.js"></script>
```

## Example

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

With the script tag, the same call is `TextStrip.create({ ... })`. The instance has `update(patch)`, `pause()`, `play()` and `destroy()`.

Main options: `textArray` (required), `stripBgColor`, `textColor`, `textSpeed`, `stripPosition` (`top` or `bottom`), `stripMode` (`fixed`, `overlay` or `static`), `dir` (`ltr`, `rtl` or `auto`), `closable`, `pauseButton`, `exposeHeightVar`. Every option except `textArray` has a default, listed in `src/options.ts`.

## Links

- Complete usage for AI agents and developers: https://mo-hawary.github.io/text-strip/llms-full.txt
- Short index for AI agents: https://mo-hawary.github.io/text-strip/llms.txt
- Agent skill: https://mo-hawary.github.io/text-strip/skills/text-strip/SKILL.md
- GitHub: https://github.com/mo-hawary/text-strip
- npm: https://www.npmjs.com/package/text-strip

MIT licensed.
