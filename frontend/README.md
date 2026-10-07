# NEXORA frontend

The current dependency-free frontend is served from `../public` by the local Node backend so the hackathon demo runs with no installation step. This directory reserves the production Next.js/React boundary. Its API base URL is configured with `NEXT_PUBLIC_API_URL`; it must never contain service-role or database secrets.
