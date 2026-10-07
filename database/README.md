# Database contract

Run migrations in lexical order against PostgreSQL. The production API must scope every query to the authenticated member's workspace. In Supabase, enable RLS and grant access only through `workspace_members` and `project_members`. Attachments remain in private object storage; only metadata lives in `task_attachments`.
