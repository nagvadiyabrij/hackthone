# NEXORA

Conflict-safe realtime collaborative workspace for ALGOTHON'26 ALG-WEB-01.

## Local run

Requires Node 18+ and has **zero third-party dependencies**:

```powershell
cd "E:\not work\hackthone"
npm start
```

Open http://localhost:3000 and sign in with `alex@nexora.local` / `NexoraDemo26!`.

The member workspace is at `/`. Administrators use the separate NEXORA Control console at `/admin.html`; admin accounts are routed there after sign-in, while workspace members stay in the user workspace.

## What is genuinely functional

- Credential-hashed registration/login/logout with HTTP-only sessions
- Separate member workspace and administrator Control Center with role-based routing
- Member profile/password editing; admin user creation, profile/access edits, suspension/reactivation, and password reset
- Admin project/task/file/identity views backed by the same workspace data and APIs
- Grouped search, team profiles, project details, and a real task/project deadline calendar
- Responsive workspace pulse with project, task, team, file, and activity metrics
- Protected API routes and persistent local workspace data (`data/nexora.json`)
- Create/update/delete task and create project operations
- Atomic revision comparison: stale `PATCH /api/tasks/:id` responds `409` with server and client versions
- Conflict comparison plus refresh or safe keep-my-changes resolution
- Server-Sent Events update all open authenticated browser sessions for task/comment/project/file actions
- Real comments and 5 MB validated local file uploads/downloads/deletes
- Dashboard health, productivity, team completion, activity and analytics calculated from stored tasks

## Security notes

This is a local hackathon application. Passwords use Node's `scrypt`; sessions are HTTP-only cookies. Inputs are bounded and escaped in the UI. For production, replace JSON storage with PostgreSQL/Supabase, enforce row-level workspace policies, issue signed object-storage URLs, add CSRF protection and configure HTTPS secrets via the platform.

## Production migration

Use `.env.example` for Vercel/Supabase variables. The key update rule remains:

```sql
UPDATE tasks SET title=$1, revision=revision+1
WHERE id=$2 AND revision=$3;
```

Zero updated rows is a conflict, never last-write-wins.
