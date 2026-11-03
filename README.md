# Princess

A mobile-first, responsive, installable (PWA) React site for a cruise line, with a C# REST API over SQL Server in `server/` and `db/`.

## Running the front end

There is one mode: the front end always talks to the REST API and keeps no data of its own (only display settings, the session token, diagnostics and caches of server answers). The server must be running for `npm run dev`. `VITE_API_URL` is optional and defaults to `/api/v1`, which the Vite proxy sends to the API.

Vite proxies `/api` to `VITE_API_PROXY` (default `http://localhost:5182`). A different API origin also needs adding to the CSP `connect-src` and the API's CORS origins.

Still mocked, on the server, on purpose: live ship telemetry and weather, and card charging. The AI concierge runs on the server when a model key is set (`Concierge:ApiKey`, user-secrets); without one, a scripted helper on the server answers.

## Running the back end

1. **Database** (SQL Server, run by hand): see `db/README.md`. Schema `db/01-schema.sql`, then the reference and persona seeds.
2. **API**: see `server/README.md`. Set the connection string and JWT signing key with user-secrets, then `cd server && dotnet run --project Princess.Api` (http://localhost:5182, Swagger at `/swagger`).
3. **Front end**: `npm run dev`, sign in with a seeded `<slug>@demo.princess.example` account (demo password in `server/README.md`).

## Front-end checks

```
npm run test      # Vitest
npm run lint      # Oxlint
npx tsc -b        # types
npm run build     # production build + PWA
```

Other scripts: `db:check`, `api:check`, `db:seed:check`, `db:persona:check` (see `package.json`).

## Documents

`docs/backend-plan.md` (phases), `docs/backend-data-model.md` (schema and API surface), `docs/functional-requirements.md`, `docs/design-language.md`.

**Stage experience.** The app changes with the guest's journey stage (11 stages, derived on the server). Each stage shows Home, two or three stage tabs and Me, from one registry, `STAGE_TABS` in `src/routes/screens.ts`. The design is in `docs/stage-experience-plan.md` and the generated matrix of tabs, tiles and screens is `docs/stage-menus-matrix.md`.
