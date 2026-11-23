# Princess

A new React web site, designed for both mobile phone and desktop use (mobile-first, responsive, installable as a PWA like the peer project `eclipse-court`).

## Stack

- Vite + React + TypeScript, plain CSS (no CSS framework).
- Oxlint for linting (react, typescript, oxc and jsx-a11y plugins), Vitest for tests.
- `vite-plugin-pwa` for offline/installable support; `viewport-fit=cover` in `index.html` for notched phones.
- Framework-free logic belongs in plain TypeScript modules under `src`, separate from React components, so it can be unit tested in a node environment.
- English only for now: do not add or update non-English (Spanish) strings for new work, and do not worry about translation coverage. Existing Spanish files stay as they are.
- Aim for WCAG 2.2 AA accessibility (keyboard use, focus-trapping dialogs that close on Escape, reduced-motion support, contrast checks).

## Source layout (`src/`)

- `app/`: the shell of the app (`main.tsx`, `App.tsx`, error boundary, route tables in `routes/`, the `runtime/` that wires the server, `screen()` lazy loading, SEO).
- `features/<name>/`: one folder per feature, with `ui/` (React), `domain/` or `logic/` (framework-free TypeScript and the feature's device store), and sometimes `hooks/`. Examples: `chat`, `stanley`, `explorer`, `games`, `account`, `plan`, `book`, `discover`.
- `shared/`: what features use in common: `ui/` primitives (Button, Dialog, Shell...), `hooks/`, `api/`, `auth/`, `data/` (including `deviceStorage.ts`, the only way to reach browser storage), `i18n/`, `settings/`, `sync/`, `feeds/`, `diagnostics/`, `design/`.
- `domain/`: the shared framework-free business rules that no single feature owns (still one flat folder; a feature's own rules belong in its `domain/`).
- `gates/`: release-gate and guard tests that read the whole source tree (security, audit, perf, wording). `testing/`: test fixtures. `assets/` and `styles/` stay at the top.
- Direction for new code: features import `shared/` and `domain/`, and `shared/` does not import a feature. Today this is not true everywhere (about 80 `shared/` files, such as some hooks and the feature stores they wrap, still import from `features/`, and most code imports `app/runtime`, the single server wiring); do not add to that, and fix it as those files are touched. Nothing enforces it yet. Put a new English string in `i18n/locales/enCore.ts` only when the first screens use it (otherwise `enRest.ts`).

## Backend

- C# REST API in `server/` (ASP.NET Core 9, Dapper, JWT) over SQL Server scripts in `db/`; see `README.md`, `server/README.md` and `docs/backend-plan.md`.
- The front end is a thin client: it talks to the server through `src/shared/api/httpApi.ts` and keeps no data store of its own, so a guest can move between devices without losing anything. Only per-device display settings, the session token, diagnostics and caches stay local. There is no requirement to keep the in-browser mock API (`src/shared/api/mock.ts` and friends) or mock-mode (no `VITE_API_URL`) working; anything the backend can serve should be removed from the front end, not mocked there.
- External sources and services (AI concierge, ship telemetry, weather, flights, traffic, card charging) are mocked by the backend behind interfaces, so a real provider can replace a mock with no front-end change. The front end must not know whether data is simulated.
- Secrets (connection string, signing key) go in user-secrets or environment variables, never git.

## Working rules (apply to every code request)

- Do not do Playwright testing or any browser testing. Verify with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only.
- Never run a full `dotnet test` for any change; verify with the npm checks only.
- Work in phases. Commit and stop after each build phase so the user can `/clear`. Do not start the next phase until asked.
- Only commit or push when asked.
