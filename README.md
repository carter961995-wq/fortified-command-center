# fortified-command-center

## Codemagic builds

This repository includes `codemagic.yaml` for the Fortified Command Center web
app. Before running the workflow in Codemagic, add the Supabase values from
`.env.example` as secure environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
