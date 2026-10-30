# Princess API

ASP.NET Core 9 (C#) REST API over the SQL Server database in `db/`. Dapper with hand-written SQL, JWT bearer auth, Swagger. Design: `docs/backend-data-model.md` (decisions D1 to D15, API surface in section 6). Plan: `docs/backend-plan.md`.

```
Princess.Api/          Auth/  Data/  Domain/  Endpoints/  Contracts/
Princess.Api.Tests/    xUnit; the whole HTTP pipeline over in-memory stores, no database needed
```

## One-time setup

Install the .NET 9 SDK (`sudo apt-get install -y dotnet-sdk-9.0`, or `dotnet-install.sh --channel 9.0`). On WSL without libicu, set `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1`.

Secrets never go in git. Set them once with user-secrets (stored outside the repo):

```
cd server/Princess.Api
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;Database=princess;Trusted_Connection=True;TrustServerCertificate=True;"
dotnet user-secrets set "Jwt:SigningKey" "<random string, 32+ characters>"
```

The API refuses to start without a signing key of at least 32 characters. In any other environment use the environment variables `ConnectionStrings__Default` and `Jwt__SigningKey`. Non-secret settings (issuer, token lifetimes, lockout, rate limit, CORS origins) are in `appsettings.json`.

## Run, build, test

```
cd server
dotnet build
dotnet test
dotnet run --project Princess.Api      # http://localhost:5182, Swagger at /swagger
```

Run it where it can reach SQL Server (the Windows side, for a Windows-authentication connection string). The schema and both seeds must already be loaded (`db/README.md`).

## Auth model

| | |
| --- | --- |
| Sign in | `POST /api/v1/auth/login` `{identifier, password}`; identifier is the email or the 10-digit account number. Returns an access token (15 min), a refresh token (30 days, stored only as a SHA-256 hash) and the person. |
| Refresh | `POST /api/v1/auth/refresh` `{refreshToken}`. The old token is spent and a new one issued. Presenting a spent token again revokes that whole session family. |
| Sign out | `POST /api/v1/auth/logout` `{refreshToken}` with the bearer token. |
| Who am I | `GET /api/v1/me`. |
| View as a child | `POST /api/v1/me/view-as/{childId}`, booker only. A 15 minute token whose `sub` is the child and `act` the booker. The child's supervised restrictions apply. |
| Lockout | 5 wrong passwords lock the account for 15 minutes. Wrong password, unknown account, locked account and a supervised child all return the identical 401 `badCredentials`. Login and refresh are also rate limited per IP (10 a minute). |

Every endpoint needs a signed-in user unless it opts out (`/health`, `/health/db`, login, refresh).

## Errors

RFC 7807 problem details. `type` is one of the `src/api/errors.ts` codes (`invalid`, `conflict`, `forbidden`, `notFound`, `challenge`, `declined`, `server`) and `title` is the token the screens switch on. Two additions that the client reads by HTTP status: **401** (`forbidden` / `unauthenticated`, `badCredentials` or `badRefreshToken`) means refresh or sign in again; **403** is final. 429 is `tooManyRequests`. A booking the caller is not on is always 404 `notFound`.

## Authorisation helpers (`Auth/AccessService.cs`)

`RequireMemberAsync`, `RequireAdultMemberAsync`, `RequireBookerAsync`, `RequireParentOf`, `RequireSelfOrHelperAsync` implement section 7 of the data-model document. The Phase 6 onward endpoints call them; the pure rules (`AccessRules`) are unit tested.

## Smoke calls (run against your database)

Seeded demo password is `Sailaway!2027`. In bash:

```
B=http://localhost:5182
curl -s $B/health                      # {"status":"ok"}
curl -s $B/health/db                   # {"status":"ok"} once the connection string works

curl -s -X POST $B/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"identifier":"gerald@demo.princess.example","password":"Sailaway!2027"}'
# Copy accessToken and refreshToken from the reply:
curl -s $B/api/v1/me -H "authorization: Bearer $ACCESS"                      # Gerald Whitfield, tier platinum

curl -s -X POST $B/api/v1/auth/refresh -H 'content-type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}"
curl -s -X POST $B/api/v1/auth/refresh -H 'content-type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}"   # second use: 401 badRefreshToken, and the new token is dead too

# Booker views as a supervised child (Daniel Harper, then Ethan or Maya; ids from the seed or the party route later)
curl -s -X POST $B/api/v1/me/view-as/<childPublicId> -H "authorization: Bearer $ACCESS"
```

In Swagger: run `/auth/login`, press **Authorize**, paste the `accessToken`, then try `/me`. Also try the account number `4100007919` as the identifier, and a wrong password six times (the sixth call and the correct password both return 401 until the lock expires).
