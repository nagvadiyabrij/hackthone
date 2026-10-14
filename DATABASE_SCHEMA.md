# Database Schema

## Local runtime

The local development runtime persists a single workspace document in `data/nexora.json` and file bytes in `uploads/`. It is durable across restarts on the same filesystem, but it is not suitable for concurrent multi-instance deployment.

## Production PostgreSQL schema

Run the six SQL migrations in lexical order from `database/migrations/`:

1. `users`: user identity, email uniqueness, password hash, and timestamps.
2. `workspaces` and `workspace_members`: workspace ownership and membership role.
3. `projects` and `project_members`: workspace-scoped work containers.
4. `tasks`: task state, priority, assignee, due date, and positive integer `revision`; indexes support project/status and assignee/due-date lookups.
5. Collaboration: `task_comments`, `task_attachments`, labels, task labels, and task dependencies.
6. Events: `activity_events` and `notifications`, indexed by workspace/time.

## Integrity rules

- Email is unique.
- Foreign keys cascade where child records cannot survive a parent deletion.
- Task status and priority use PostgreSQL enum types.
- A task update must be conditional on its current revision: `UPDATE ... WHERE id = $1 AND revision = $2`.
- Use transactions for operations spanning multiple rows, including account/session revocation and project member changes.

## Migration note

The current Node server does not execute these SQL files. Do not point a production deployment at them until a PostgreSQL data adapter and row-level authorization are implemented and tested.
