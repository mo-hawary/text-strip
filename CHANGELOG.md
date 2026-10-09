# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-10-09

### Fixed

- A static strip inside a grid or flex item no longer expands its container to the full text width (which made it stop scrolling). The scroll wrapper now uses `contain: inline-size`.

## [0.1.0] - 2026-10-09

First public release.

### Added

- Single configuration object: `createTextStrip(options)`, with `create` as an alias.
- Three strip modes with `stripMode`: `'fixed'` (default, stays on screen and reserves space), `'overlay'` (stays on screen and takes no space) and `'static'` (part of the page flow).
- The strip at the top or bottom of the page (`stripPosition`).
- Direction with `dir`: `'auto'` (default, follows the first strong character of the texts), `'ltr'` or `'rtl'`. Each item is bidi-isolated, so mixed Arabic and English keeps its word order.
- Link items in `textArray` as `{ text, href }`. Only `http`, `https`, `mailto` and `tel` URLs become links; other schemes render as plain text.
- Scroll speed in pixels per second (`textSpeed`).
- Seamless loop that keeps its progress when the window is resized.
- Fit mode: texts that fit are shown centered and still, without scrolling.
- Built-in pause and play button (`pauseButton`, `pauseLabel`, `playLabel`), keyboard operable.
- Pause on hover when `pauseOnHover` is true, and always while keyboard focus is inside the moving text. The pause and close buttons never move with the text.
- `prefers-reduced-motion` support (`respectReducedMotion`), where the scrolling stops and the strip can be scrolled by hand.
- Separator, gap, height, font size and font family options (`separator`, `gap`, `height`, `fontSize`, `fontFamily`).
- Close button with `closeLabel`, `onClose` and `rememberDismiss` (stores the dismissal in `localStorage`).
- `mountTarget` to place the strip inside a chosen element.
- Stacking of fixed and overlay strips on the same side, in creation order. A static top strip is never covered by a fixed top strip, because fixed strips reserve their space first.
- Shared registry: two copies of the library on one page (for example CDN plus npm) share one registry, so stacking and `exposeHeightVar` still work.
- Opt-in `exposeHeightVar` that sets `--text-strip-height` on `:root` for sticky headers.
- Instance API: `update()`, `pause()`, `play()`, `destroy()` and `element`.
- Shadow DOM isolation, hardened: host pseudo-elements are neutralized and no CSS custom properties are read inside the shadow tree, so page styles cannot leak in or out.
- Content Security Policy and Trusted Types safe rendering, with no `innerHTML`. Works under `style-src 'self'` in browsers with constructable stylesheets.
- Safe to load in `<head>` and during server-side rendering.
- ESM, CJS and IIFE/CDN builds with TypeScript types.
- Bundle size about 4 KB gzip (ESM 3.8 KB, CDN 4.0 KB), enforced by `npm run size` for both the ESM and the CDN build.
- Source split into small single-purpose modules with comments for readability.

[Unreleased]: https://github.com/mo-hawary/text-strip/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/mo-hawary/text-strip/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/mo-hawary/text-strip/releases/tag/v0.1.0
