# Project Audit

## Current architecture

NEXORA is a Node.js 18+ application with no third-party runtime dependencies. `server.js` serves the browser application, implements the REST/SSE API, and persists the local demo workspace in `data/nexora.json`. `admin.js` contains the server-side account and administrator authorization handlers. The primary browser assets are `public/index.html`, `public/nexora-app.js`, `public/nexora.css`, and the separate admin console assets.

PostgreSQL migrations are present under `database/migrations`, but the local server does not yet use PostgreSQL.

## Verified working features

- Passwords are hashed with Node `scrypt`; sessions use HTTP-only cookies.
- Member registration, login, logout, account/password changes, projects, tasks, comments, uploads, downloads, and task revision conflicts are implemented.
- Admin authorization is server-enforced. User management, workspace settings, task administration, and audit activity use the same persistent local data store.
- Browser clients receive authenticated Server-Sent Events for workspace changes.
- The included integration test covers account authorization, task revisions, session revocation, and admin user lifecycle operations.

## Findings and priority

1. **Production storage is not connected (high):** the running server persists to local JSON and local uploads. PostgreSQL migrations document the intended production schema but no adapter is implemented.
2. **Production deployment is blocked (high):** no hosting account, database connection string, domain, TLS certificate, or object-storage credentials are available in this workspace.
3. **Security hardening is incomplete (high):** local HTTP cookies are intentionally not marked `Secure`; CSRF protection and production cookie/CORS configuration still need deployment-aware configuration. Login/registration throttling and baseline security headers are implemented locally.
4. **Operational visibility is incomplete (medium):** the original server had no public health/readiness route or structured logs.
5. **Password recovery is absent (medium):** users can change a known password and administrators can reset one, but no email-delivered recovery workflow exists because no mail provider is configured.
6. **Legacy duplicate frontend files exist (low):** `public/app.js`, `dashboard.js`, `member-pages.js`, `search.js`, `user-panels.js`, and old CSS layers are retained but the shipped member page loads `nexora-app.js` and `nexora.css`.

## Remediation status

- Local API explorer, responsive mobile styling, route-state handling, and consistent admin sign-in routing were added in this workspace.
- `GET /healthz` now provides a local readiness response and the server sets basic clickjacking, MIME-sniffing, referrer, and browser-permissions response headers.
- A verified public HTTPS deployment cannot be completed without a hosting account and production secrets; see `DEPLOYMENT_GUIDE.md`.
