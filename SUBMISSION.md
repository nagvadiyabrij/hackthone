# NEXORA — ALGOTHON'26 Submission

## Project title
NEXORA — One Living Workspace for Teams

## Project description
NEXORA connects a team's projects, tasks, people, files, and activity in one live workspace. Members plan work on a shared task board and calendar; realtime events keep changes visible, while revision checks catch stale edits before they overwrite teammates' work. Administrators manage accounts and access in a separate Control Center.

## Problem statement & solution
Teams lose time and context when project plans, task ownership, files, and updates live in disconnected tools. NEXORA brings those workflows into a shared workspace with persistent project data, comments, file uploads, and live event updates. Its revision-aware task API detects stale edits and gives the editor an explicit compare, refresh, or safe-retry path.

## Technology stack
Node.js built-in HTTP and crypto modules, semantic HTML, CSS, vanilla JavaScript, JSON file persistence, Server-Sent Events, scrypt password hashing, and HTTP-only session cookies. The local demo uses no third-party JavaScript dependencies.

## Repository and demo
Repository: not published.

Local demo: run `npm start`, then open `http://localhost:3000`. The seeded member account is `priya@nexora.local`; the seeded administrator is `alex@nexora.local`. Both demo passwords are `NexoraDemo26!`. The admin console is available at `/admin.html`.

## Key features
- Separate member workspace and administrator Control Center with role-based routing
- Data-driven productivity dashboard, project details, team profiles, and month calendar
- Task board with status, priority, assignment, comments, and revision-safe edits
- Project and task deadlines, activity timeline, grouped search, and workload views
- Private local file storage with a 5 MB upload limit
- Realtime task, project, comment, file, account, and workspace events
- Admin account creation/editing, access changes, suspension/reactivation, and password resets
- Admin project/task/file registers, analytics, activity logs, workspace settings, and application-level health

## Demo flow (2–3 minutes)
1. **Workspace pulse:** Sign in as Priya and show the real task, project, team, file, activity, and deadline metrics.
2. **Project planning:** Open a project card, review its progress and tasks, then open one task and add a comment.
3. **Conflict safety:** Open the same task in two sessions. Save an edit from the first session, then save the stale draft from the second. Show the revision conflict and compare/refresh/safe-retry choices.
4. **Realtime:** Keep the second session open and make another task change; show its event-driven update.
5. **Control Center:** Sign in as Alex, review the workspace overview and users, then demonstrate account status and permission management.

## Scope notes
The local API currently enforces Administrator and Member access; job titles do not grant permissions. Project archive/edit, account last-login timestamps, and persisted notification read state are not implemented and are not presented as working controls.
