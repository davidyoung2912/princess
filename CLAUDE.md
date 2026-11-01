# Princess

A new React web site, designed for both mobile phone and desktop use (mobile-first, responsive, installable as a PWA like the peer project `eclipse-court`).

## Stack

- Vite + React + TypeScript, plain CSS (no CSS framework).
- Oxlint for linting (react, typescript, oxc and jsx-a11y plugins), Vitest for tests.
- `vite-plugin-pwa` for offline/installable support; `viewport-fit=cover` in `index.html` for notched phones.
- Framework-free logic belongs in plain TypeScript modules under `src`, separate from React components, so it can be unit tested in a node environment.
- Aim for WCAG 2.2 AA accessibility (keyboard use, focus-trapping dialogs that close on Escape, reduced-motion support, contrast checks).

## Backend

- C# REST API in `server/` (ASP.NET Core 9, Dapper, JWT) over SQL Server scripts in `db/`; see `README.md`, `server/README.md` and `docs/backend-plan.md`.
- The front end talks to it through `src/api/httpApi.ts` when `VITE_API_URL` is set; otherwise the in-browser mock API (`src/api/mock.ts` and friends) and demo picker are used. Both must keep working.
- Intentionally mocked in every mode: AI concierge, ship telemetry and weather, card charging.
- Secrets (connection string, signing key) go in user-secrets or environment variables, never git.

## Working rules (apply to every code request)

- Do not do Playwright testing or any browser testing. Verify with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only.
- Never run a full `dotnet test` for any change; verify with the npm checks only.
- Work in phases. Commit and stop after each build phase so the user can `/clear`. Do not start the next phase until asked.
- Only commit or push when asked.
