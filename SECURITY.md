# Security Policy

## Supported versions

text-strip is pre-1.0. Only the latest release on the 0.x line receives security fixes.

| Version | Supported |
| --- | --- |
| Latest 0.x release | Yes |
| Older 0.x releases | No, upgrade to the latest |

## Reporting a vulnerability

Please report security issues privately. Do not open a public issue, pull request or discussion for a vulnerability.

Use GitHub private vulnerability reporting: https://github.com/mo-hawary/text-strip/security/advisories/new

Include, if you can:

- The text-strip version and the browser and OS you tested on.
- A minimal page or steps that reproduce the problem.
- The impact you expect, for example script execution, style leakage out of the Shadow DOM, or a Content Security Policy or Trusted Types bypass.

## Response expectations

- We will acknowledge your report within 7 days.
- We will keep you updated on the assessment and the fix.
- Once a fix is released, we will publish a security advisory and credit the reporter if you want to be credited.

## Scope notes

- text-strip renders user-supplied text with `textContent` only. It never parses strings as HTML and does not use `innerHTML`. Reports that show HTML or script injection through `textArray` or `ariaLabel` are in scope.
- Link items in `textArray` (`{ text, href }`) become anchors only for `http:`, `https:`, `mailto:` and `tel:` URLs. Any other scheme, such as `javascript:` or `data:`, renders as plain text and is not linked. A link that bypasses this rule is in scope.
- Style options such as `stripBgColor`, `textColor` and `fontFamily` are applied through the CSSOM (element style properties). The browser ignores invalid values, so a malformed value does not inject markup or stylesheet text. Invalid values that only look wrong visually are not a security issue. Please report them as regular bugs.
- The strip renders inside a Shadow DOM. Page styles cannot reach it, and it does not change page styles, except for the opt-in `exposeHeightVar` option, which sets one CSS variable on `:root`.
- Problems in the host page itself, in other scripts loaded on the page, or in the browser are outside the scope of this project.
