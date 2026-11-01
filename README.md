# Princess

A mobile-first, responsive, installable (PWA) React site for a cruise line, with a C# REST API over SQL Server in `server/` and `db/`.

## Two ways to run the front end

| Mode | How | What you get |
| --- | --- | --- |
| Demo (no API) | `npm install && npm run dev` | The demo persona picker and the in-browser mock API (IndexedDB). No server needed. |
| Real API | Set `VITE_API_URL=/api/v1` (for example in `.env.local`), then `npm run dev` | Email or account number plus password sign-in; every journey group is served by the REST API. |

Vite proxies `/api` to `VITE_API_PROXY` (default `http://localhost:5182`). A different API origin also needs adding to the CSP `connect-src` and the API's CORS origins.

Still mocked in both modes, on purpose: the AI concierge, live ship telemetry and weather, and card charging.

## Running the back end

1. **Database** (SQL Server, run by hand): see `db/README.md`. Schema `db/01-schema.sql`, then the reference and persona seeds.
2. **API**: see `server/README.md`. Set the connection string and JWT signing key with user-secrets, then `cd server && dotnet run --project Princess.Api` (http://localhost:5182, Swagger at `/swagger`).
3. **Front end**: `VITE_API_URL=/api/v1 npm run dev`, sign in with a seeded `<slug>@demo.princess.example` account (demo password in `server/README.md`).

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
