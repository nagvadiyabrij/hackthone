# Deployment Guide

## Local development

```powershell
npm start
```

Open `http://localhost:3000`. The server writes development data to `data/nexora.json` and uploads to `uploads/`.

## Required production services

Before public deployment, provide:

- A Node-compatible hosting account and deployment authorization.
- PostgreSQL connection string (`DATABASE_URL`).
- Private object-storage configuration for uploads.
- A domain/TLS configuration or a hosting platform HTTPS URL.
- A strong session secret (`AUTH_SECRET`) and allowed frontend origin.
- Optional transactional-email credentials for password recovery.

## Required production changes

1. Implement and test the PostgreSQL repository against the migrations in `database/migrations`.
2. Replace local filesystem uploads with private object storage and signed download URLs.
3. Set secure HTTPS cookies, CSRF protection, rate limiting, CORS allow-list, and request/security logging.
4. Apply migrations in order and create the first administrator through a controlled setup process.
5. Run `npm run check` and `npm test`, then smoke-test login, member workflow, admin workflow, uploads, health endpoint, and SSE on the deployed HTTPS URL.
6. Configure backups for PostgreSQL and object storage; test a restore before launch.

## Current deployment status

No public deployment has been made. A public HTTPS URL cannot be honestly provided until hosting credentials, database/storage configuration, and a production deployment target are supplied.
