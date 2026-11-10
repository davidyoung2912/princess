# Static host headers for `dist/`

The API sets its own security headers (`SecurityHeaders.cs`). The front end is static files, so the host or CDN that serves `dist/` must set these. Adjust `connect-src` to the real API origin, and add its `wss://` address too: the live chat connection is a WebSocket to `/hubs/chat` on the API host (the build adds both when `VITE_API_URL` is absolute).

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.example.com; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (add `preload` only once every subdomain is HTTPS) |
| `X-Frame-Options` | `DENY` (older browsers; `frame-ancestors` is the real control) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` (widen only for a feature that needs it) |

## Caching

- `assets/*` (hashed file names): `Cache-Control: public, max-age=31536000, immutable`.
- `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest`: `Cache-Control: no-cache` so a new deploy is picked up. Never cache the service worker long.
- `.well-known/security.txt`: `Cache-Control: public, max-age=86400`.

## Compression

Serve Brotli (`br`) with gzip as the fallback for `.js`, `.css`, `.html`, `.svg`, `.json` and `.webmanifest`. Precompress at deploy time if the host allows. Do not compress PNG or WebP.

## security.txt

`public/.well-known/security.txt` still holds the placeholder contact (`security@example.invalid`). Replace it with a monitored address before launch, and set `Security:Contact` on the API to the same value.
