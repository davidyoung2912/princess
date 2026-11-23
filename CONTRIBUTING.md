# Contributing

## Before you push

```
npm run lint
npx tsc -b
npm run test           # or npm run test:coverage, which CI runs
npm run build
npm run bundle:check
```

CI (`.github/workflows/ci.yml`) runs these, a production `npm audit`, and `dotnet build` with a vulnerable-package check for the API.

## Rules of the house

- The front end is a thin client: no data store of its own, no mock API. Anything the server can serve is removed from the front end, not mocked there. External services are simulated on the server behind interfaces (`Providers:*`); the front end must not know whether data is simulated.
- Logic that does not need React goes in plain TypeScript under `src` with a node-environment unit test. Components do not create components while rendering, do not set state in effects to copy props, and keep non-component exports in their own files (lint enforces these).
- English only for now. Do not add Spanish strings.
- Accessibility to WCAG 2.2 AA: keyboard use, dialogs that trap focus and close on Escape, reduced motion, contrast. A new map, chart or grid needs a text equivalent.
- Secrets (connection string, signing key, API keys) go in user-secrets or environment variables, never git. Generated files (`content:gen`, `portguides:gen` and others) are checked by tests; regenerate rather than edit.
- Do not run browser tests. Server tests are run by name, not as a full `dotnet test`, unless the owner asks.
- Commit one phase at a time with a message that says what changed and why.

## Adding an external provider

Write the interface and a `sim` implementation, register both in `server/Princess.Api/Services/ProviderRegistration.cs`, wrap the real one in `ProviderGuard`, add it to `docs/runbook.md`. For an MCP server, add its tools to `McpEgressPolicy` (read-only, no free text) and see `docs/mcp-integration-plan.md`.

## Licence

No licence has been chosen yet; until the owner picks one, all rights are reserved.
