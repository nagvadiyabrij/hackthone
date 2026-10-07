# NEXORA backend

The local API runtime is `../server.js`. It owns session authentication, authorization checks, project/task/comment/file mutations, revision conflicts, JSON persistence and Server-Sent Events. Production deployment should replace the local data adapter with PostgreSQL/Supabase and use the migrations in `../database/migrations`.
