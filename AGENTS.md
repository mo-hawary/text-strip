# AGENTS.md

Instructions for AI agents that contribute to the text-strip repo. Read this before you change code.
For how to USE text-strip on a site, read `llms-full.txt` or `skills/text-strip/SKILL.md`.

## Setup

- Node.js 22.12 or newer, and npm.
- `npm ci`, then `npx playwright install` (needed for e2e tests).

## Commands

- `npm run check`: typecheck, unit tests, build and the size gate. Run it before every commit.
- `npm run test:e2e`: builds, then runs Playwright on Chromium, Firefox and WebKit.
- `npm run demo`: builds, then serves the repo at http://localhost:4173/demo/index.html.
- `npm run size` reads `dist/`, so run `npm run build` first.

## Hard rules

- Zero runtime dependencies. Dev dependencies are fine when needed for development or tests.
- Size budgets (gzip, level 9), enforced by `npm run size`: `dist/index.js` at most 3900 bytes, `dist/index.global.js` (CDN) at most 4150 bytes. If a feature does not fit, open an issue before you write code.
- Never touch host page styles or elements. Render inside the Shadow DOM only, and style through the CSSOM only. The one exception is `exposeHeightVar`, which sets `--text-strip-height` on `:root`.
- No `innerHTML`. Insert text with `textContent`. Keep the code safe under strict CSP (`style-src 'self'`) and Trusted Types.
- RTL must keep working. Check `dir: 'rtl'` and mixed Arabic and English items, and keep the bidi isolation of each item.
- Link protocols stay limited to `http:`, `https:`, `mailto:` and `tel:`.
- Every behavior change needs unit tests in `tests/` (Vitest, happy-dom). Behavior that needs a real browser (layout, scrolling, focus, reduced motion) also needs tests in `e2e/`.
- Keep TypeScript on 5.x. The tsup dts build breaks on TypeScript 7.
- No em dash or en dash characters in code, comments, docs or strings. Use commas, colons, parentheses or plain hyphens.

## Where things live

`src/strip.ts` orchestrates. The other modules each do one job: `options.ts`, `styles.ts`, `dom.ts`, `text.ts`, `storage.ts`, `registry.ts`, `render.ts`, `loop.ts`, `mount.ts`. The Project structure section of README.md has the full list.

## Boundaries

- Never publish to npm, push tags or create releases.
- Never edit `dist/` by hand. `npm run build` generates it.
- Do not change public option names, defaults or types without a CHANGELOG entry under `## [Unreleased]`. Update README.md and README.ar.md too.
- `main` is protected. Work on a branch and open a pull request.
- Keep changes small. Do not mix refactors with feature or fix work.

## Commits and pull requests

- Use a short imperative subject under about 72 characters, for example `Add closeLabel option`. Add a body when the reason is not obvious from the diff.
- Run `npm run check` and `npm run test:e2e` before you open a PR. Complete `.github/PULL_REQUEST_TEMPLATE.md`.
