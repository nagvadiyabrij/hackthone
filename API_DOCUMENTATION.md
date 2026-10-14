# API Documentation

Base URL (local): `http://localhost:3000`.

`GET /healthz` is unauthenticated and returns `{ "status": "ok", "storage": "local-json", "time": "..." }` when the local server is ready to accept traffic.

Authenticated endpoints require the `nexora_sid` HTTP-only cookie issued by login or registration. All JSON requests use `Content-Type: application/json`.

## Authentication

| Method | Route | Body | Success |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `name`, `email`, `password` | `201 { user }` |
| POST | `/api/auth/login` | `email`, `password` | `200 { user }` + session cookie |
| POST | `/api/auth/logout` | none | `200 { ok: true }` |

Registration requires a two-character name, valid email, and an eight-character password. Invalid credentials return `401`; duplicate email returns `409`.

Login and registration are throttled to 10 attempts per client address in 15 minutes. Further attempts receive `429` with a `Retry-After` header.

## Member API

| Method | Route | Request | Result |
| --- | --- | --- | --- |
| GET | `/api/me` | none | current safe user + workspace snapshot |
| PATCH | `/api/account` | `name`, optional `currentPassword`, `newPassword` | updated safe user |
| GET | `/api/events` | none | authenticated SSE stream |
| POST | `/api/projects` | `name`, `description`, `deadline` | created project |
| POST | `/api/tasks` | `title`, `projectId`, optional task fields | created task |
| PATCH | `/api/tasks/:id` | task fields and required `revision` | updated task or `409 CONFLICT` |
| DELETE | `/api/tasks/:id` | none | `{ ok: true }` |
| POST | `/api/tasks/:id/comments` | `text` | created comment |
| PATCH/DELETE | `/api/comments/:id` | `text` for PATCH | updated/deleted comment |
| POST | `/api/files` | `name`, `type`, base64 `data`, `projectId` | created file metadata |
| GET/DELETE | `/api/files/:id[/download]` | none | download/deleted file |

File uploads are limited to 5 MB by the server.

## Administrator API

All routes below require `access: admin`; standard users receive `403 ADMIN_REQUIRED`.

| Method | Route | Request |
| --- | --- | --- |
| GET/POST | `/api/admin/users` | POST accepts `name`, `email`, `password`, `role`, `access` |
| PATCH/DELETE | `/api/admin/users/:id` | PATCH accepts profile fields, `access`, `active`, and `newPassword` |
| PATCH | `/api/admin/workspace` | `name` |

## Error format

Errors are JSON: `{ "error": "MESSAGE" }`. Common statuses are `401` unauthenticated, `403` unauthorized, `404` missing resource, `409` conflict, `413` oversized file, and `422` validation failure.

An interactive local reference page is served at `/api.html`.
