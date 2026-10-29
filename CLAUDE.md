# Princess

A new React web site, designed for both mobile phone and desktop use (mobile-first, responsive, installable as a PWA like the peer project `eclipse-court`).

## Stack

- Vite + React + TypeScript, plain CSS (no CSS framework).
- Oxlint for linting (react, typescript, oxc and jsx-a11y plugins), Vitest for tests.
- `vite-plugin-pwa` for offline/installable support; `viewport-fit=cover` in `index.html` for notched phones.
- Framework-free logic belongs in plain TypeScript modules under `src`, separate from React components, so it can be unit tested in a node environment.
- Aim for WCAG 2.2 AA accessibility (keyboard use, focus-trapping dialogs that close on Escape, reduced-motion support, contrast checks).

## Working rules (apply to every code request)

- Do not do Playwright testing or any browser testing. Verify with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only.
- Work in phases. Commit and stop after each build phase so the user can `/clear`. Do not start the next phase until asked.
- Only commit or push when asked.
