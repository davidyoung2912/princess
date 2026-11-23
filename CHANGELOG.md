# Changelog

Notable changes, newest first. The project is pre-release; versions are not cut yet.

## Unreleased (November 2026)

- Plan my port day on Port Details: a timed walking plan against the ship's all-aboard time, with a map and a return-by time.
- Stanley can plan a port day (`plan_port_day`) with weather notes, and `GET /reference/port-guides/{id}/walking-plan` serves the same plan.
- Princess now has a read-only MCP server (`POST /api/v1/mcp`) and a `Providers:PortKnowledge` setting that reads port places through the MCP gateway; `docs/mobi-mcp-mapping.md` says what we would ask Mobi for.
- Help centre shows "Where our information comes from" (`GET /help/connected-services`); Stanley has `get_port_weather`; the MCP server also offers `search_ship_venues` and `list_excursions`.
- Maps on Port Details: a self-drawn map of the things to do with numbered pins, "Show on map" on each place, Google Maps links, and an optional click-to-load Google embed (set `VITE_GOOGLE_MAPS_EMBED_KEY`).
- MCP gateway on the server (`Services/Mcp`): client, read-only egress allowlist, sanitiser, guarded calls, health rows. Every provider is off by default. See `docs/mcp-integration-plan.md`.
- Code health: all lint warnings fixed, coverage reporting with floors in CI, CI workflow, documentation index and archive, contributing guide.
- Review phases A to J (venues, events, menus, excursion candidates, stats, security, performance, code health, pages, chat, tour steps, Stanley ideas): see `docs/review-and-completeness-plan.md`.
