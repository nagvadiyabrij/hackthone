# API contract

Implemented local endpoints: `POST /api/auth/login`, `/register`, `/logout`; `GET /api/me`, `/api/events`; `PATCH /api/account`; `POST /api/projects`; `POST /api/tasks`; `PATCH|DELETE /api/tasks/:id`; `POST /api/tasks/:id/comments`; `PATCH|DELETE /api/comments/:id`; `POST /api/files`; `GET|DELETE /api/files/:id`.

Administrator endpoints require an authenticated administrator: `GET|POST /api/admin/users`, `PATCH|DELETE /api/admin/users/:id`, and `PATCH /api/admin/workspace`. User responses never include password hashes or salts. The current access model has two enforced levels: `admin` and `user`; job titles are descriptive only.

`PATCH /api/admin/users/:id` accepts `active` and `newPassword` in addition to profile/access fields. Suspending an account revokes its current sessions; resetting a password signs out that user's existing sessions. The last active administrator and the current administrator cannot be suspended, and accounts with assigned tasks cannot be deleted.

Authenticated SSE streams are associated with their session and are closed on logout, account suspension/deletion, and password reset.

Task PATCH requires `revision`. A stale revision returns `409` with `serverTask` and `clientTask`—never a silent overwrite.
