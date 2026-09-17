# Sravantix application

This is the React/Vite frontend and the original Convex functions exported from Hercules.

## Local development

Requirements: Node.js 22 or newer and pnpm.

```powershell
Copy-Item .env.example .env.local
pnpm install
pnpm dev
```

The values in `.env.local` must point to a running Convex deployment and an OIDC provider. The `VITE_HERCULES_*` values are still required by the current application; they are not database credentials.

## Current migration boundary

The frontend still calls the functions in `convex/` through `convex/react` and still authenticates through `@usehercules/auth`. The separate `Sravantix_db` project contains an exported JSONL snapshot and a generic PostgreSQL CRUD server; it is not yet a replacement backend for this application.

Do not remove the Convex providers until an equivalent authenticated API has been implemented and the affected pages have been migrated. Migrate one complete module at a time, starting with Projects and its Units, then run the frontend tests and build before moving to another module.

## Checks

```powershell
pnpm build
pnpm test
pnpm lint
```

## Render frontend deployment

The included `render.yaml` describes a static Render site for this Vite
frontend. It builds the React application and rewrites client-side routes to
`index.html`. Provide the Hercules/Convex environment values in Render while
the backend migration is in progress, and leave `VITE_MIGRATION_API` set to
`false` until the independent authentication and API are production-ready.

When Supabase authentication is ready, add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` to the frontend environment. The anon key is intended
for browser use; never put a Supabase service-role key in this project.