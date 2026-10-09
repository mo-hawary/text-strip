# Contributing to text-strip

Thanks for helping improve text-strip. This guide covers local setup, the scripts you will use, the project layout and the rules every change must follow.

## Development setup

You need Node.js 22.12 or newer and npm. The development tools (Vitest 5 and Playwright) require it. The published library has no Node.js runtime requirement, since it runs in the browser.

```sh
git clone https://github.com/mo-hawary/text-strip.git
cd text-strip
npm ci
npx playwright install
```

`npm ci` installs the locked dependency tree. `npx playwright install` downloads the browsers used by the end-to-end tests (Chromium, Firefox and WebKit).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run check` | Typecheck, unit tests, build and the size gate. Run this before every commit. |
| `npm run test:e2e` | Builds the package, then runs Playwright on Chromium, Firefox and WebKit. |
| `npm run demo` | Builds the package, then serves the repo at http://localhost:4173. Open http://localhost:4173/demo/index.html. |
| `npm run build` | Builds `dist/` (ESM, CJS, IIFE and type declarations) with tsup. |
| `npm run size` | Checks two gzip budgets (level 9): `dist/index.js` (ESM) must be at most 3584 bytes and `dist/index.global.js` (CDN IIFE) at most 3840 bytes. Run `npm run build` first. |
| `npm test` | Runs the unit tests with Vitest. |
| `npm run typecheck` | Runs `tsc --noEmit`. |

## Project layout

```
src/
  index.ts     Public entry point and exports
  options.ts   Option types and defaults
  styles.ts    Stylesheet used inside the Shadow DOM
  strip.ts     Rendering, scrolling, layout and instance API
tests/         Unit tests (Vitest, happy-dom)
e2e/           Browser tests (Playwright)
demo/          Demo pages, including a strict CSP page
scripts/       Dev server and bundle size check
dist/          Build output (generated, not committed)
```

## Hard rules

Every change must follow these rules. Reviews check them first.

- **Zero runtime dependencies.** Do not add anything to `dependencies`. Dev dependencies are fine when they are needed for development or tests.
- **Bundle budget.** The ESM bundle (`dist/index.js`) must stay at or under 3584 bytes gzip (3.5 KiB), and the CDN IIFE bundle (`dist/index.global.js`) at or under 3840 bytes gzip. `npm run size` enforces both. If a feature does not fit, discuss it in an issue before writing code.
- **Never touch host page styles.** Text-strip renders inside a Shadow DOM. Do not edit `<html>`, `<body>` or host elements, do not add global CSS, and do not change page variables. The only exception is the opt-in `exposeHeightVar` option, which sets one variable on `:root`.
- **No `innerHTML`.** Insert text with `textContent` only. Code must stay safe under a strict Content Security Policy (`style-src 'self'`) and under Trusted Types.
- **RTL must keep working.** Check changes with `dir: 'rtl'` and with mixed Arabic and English items. Each item must keep its bidi isolation.
- **Add tests for behavior changes.** Unit tests go in `tests/`. Behavior that depends on a real browser (layout, scrolling, focus, reduced motion) goes in `e2e/`.
- **No em dash or en dash characters** in code, comments, docs or strings. Use a comma, a colon, parentheses or a plain hyphen.
- **Keep changes small.** Do not mix refactors with feature or fix work.

## Commit messages

Use a short imperative subject, for example `Add closeLabel option` or `Fix RTL spacing in static mode`. Keep the subject under about 72 characters. Add a body when the reason for the change is not obvious from the diff.

## Pull requests

1. Create a branch from `main`.
2. Make the change, with tests.
3. Run `npm run check` and `npm run test:e2e`.
4. Update `README.md`, `README.ar.md` (for option and usage changes) and `CHANGELOG.md` when the public behavior changes. Add an entry under `## [Unreleased]`.
5. Open a pull request. The PR template lists the checklist to complete (`.github/PULL_REQUEST_TEMPLATE.md`).

For bugs and feature ideas, open an issue with the matching form. For security problems, follow [SECURITY.md](./SECURITY.md) and do not open a public issue.

## Code of conduct

Everyone who takes part in the project is expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
