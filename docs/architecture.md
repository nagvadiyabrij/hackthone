# Architecture

```text
Browser frontend → authenticated REST/SSE API → service layer → PostgreSQL
                                      └────────→ private object storage
```

The local demo uses the same boundaries with a JSON adapter and local private upload directory. Events are Server-Sent Events; production can use Supabase Realtime after workspace authorization. Task writes include the client revision. A zero-row conditional update maps to HTTP 409 and returns both versions for explicit resolution.
