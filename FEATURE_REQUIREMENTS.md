# Functional Requirements

## User workspace

- Users can register, authenticate, sign out, update their name/password, and see only authenticated workspace data.
- Users can create projects and tasks, edit tasks with revision conflict detection, delete permitted tasks/comments/files, upload files up to 5 MB, download files, and use search/filter views.
- Dashboard, project, calendar, team, files, analytics, activity, notifications, and settings views must render meaningful persisted data or an explicit empty state.
- Member UI must work at desktop, tablet, and mobile widths.

## Administrator workspace

- Admin routes must be protected on the server.
- Administrators can manage workspace settings and users, including access level, activation, password reset, and safe deletion.
- The last active administrator cannot be suspended, deleted, or demoted. Users assigned to tasks cannot be deleted.
- Admin metrics and lists must be derived from persisted workspace data.

## API and reliability

- All mutation endpoints validate input and return JSON error responses with correct 4xx/5xx statuses.
- Mutations require an authenticated session; administrator operations require administrator access.
- Stale task revisions return `409 CONFLICT`, preserving server and client versions.
- Realtime event streams close when a session is revoked.
- The server must expose health/readiness information and document local versus production configuration.

## Production requirements

- Replace local JSON/uploads with PostgreSQL and private object storage before production use.
- Configure HTTPS, a secure cookie policy, CSRF protection, login rate limiting, secrets, CORS origin allow-list, backups, and monitored logs.
- Configure a transactional email provider before implementing password-reset email delivery.
