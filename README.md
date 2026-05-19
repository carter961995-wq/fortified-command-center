# Fortified Work Order Command Center

Internal admin dashboard for **Fortified Fence & Weld**: commercial fence, gate, welding, security grille, bollard, and facilities maintenance work across multiple states. Built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, **shadcn/ui (Base UI)**, and **Supabase** (PostgreSQL, Auth, Storage, Row Level Security).

## Features (MVP)

- **Authentication**: Supabase email/password; middleware protects app routes; staff access limited to `owner` and `admin` roles in `users_profile`.
- **Dashboard**: Open work orders, billing pipeline counts, MTD revenue / gross profit / margin, recent WOs, scheduled jobs, invoices needing attention.
- **CRUD**: Customers, locations, subcontractors, work orders (status, job costs, photos/documents via storage upload).
- **Quotes & invoices**: Line items, tax, status workflows; create invoice from work order or approved quote.
- **Payments**: Record payments; balances and invoice status recalculated automatically.
- **PDF invoices**: Server-side generation with `@react-pdf/renderer`, uploaded to the `invoices` storage bucket.
- **Maintenance contracts**: Create contracts, generate scheduled visits, link visits to work orders.
- **Reports**: Rolling twelve-month revenue and P&amp;L rollups, open AR, subcontractor scorecard, job costs by sub.
- **Settings**: Placeholders for Stripe and QuickBooks integration.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com/) project only if you want persistent production-style data

## Download and run locally

For a local demo with seeded in-memory data, no Supabase setup is required:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app automatically uses demo mode when Supabase
environment variables are missing or still set to the placeholder values from `.env.example`.

Demo mode includes sample customers, locations, subcontractors, work orders, quotes, invoices, payments,
maintenance contracts, and reports. Changes are stored in memory and reset when the dev server restarts.

## Environment variables

For real persisted data, copy `.env.example` to `.env.local`, replace the placeholders with real Supabase
values, and set `NEXT_PUBLIC_DEMO_MODE=false` if you want to force Supabase mode:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_DEMO_MODE` | Optional. `true` forces demo mode; `false` forces Supabase mode |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key — used in browser and server with user session |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **server only**; used for privileged storage uploads (e.g. invoice PDFs) |

Never expose the service role key to the client.

## Supabase setup

1. Create a project in the Supabase dashboard.
2. Run SQL migrations (see below) in the SQL editor, or use the Supabase CLI linked to this repo.
3. **Authentication**: Enable Email provider; create your first user under Authentication → Users.
4. **Profiles**: After first login, ensure `users_profile` has `role` set to `owner` or `admin` for that user (the migration seeds triggers for new users defaulting to `admin`; adjust in SQL as needed for your first account).

## Database migrations

SQL lives in `supabase/migrations/`. Apply in order (e.g. copy `20250515000000_initial_schema.sql` into the Supabase SQL editor and execute), or:

```bash
# If using Supabase CLI and linked project
supabase db push
```

The migration defines tables (`customers`, `locations`, `work_orders`, `quotes`, `invoices`, `payments`, `maintenance_contracts`, etc.), RLS policies (staff admin full access for MVP), storage buckets, seed data, and the `work_order_financials` view.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Supabase keys, you are taken directly into
the demo dashboard. With real Supabase keys, unauthenticated users are sent to `/login`.

## Production build

```bash
npm run build
npm start
```

## What to build next

- **Stripe**: Card/ACH capture and webhook reconciliation (hooks stubbed in Settings).
- **QuickBooks**: Invoice and payment export (stub in Settings).
- **Portals**: Subcontractor and customer portals with tightened RLS (schema is already role-oriented).
- **Dispatcher role**: Route planning and assignment UI.
- **Notifications**: Email/SMS on quote sent, invoice sent, overdue AR.
- **Deeper reports**: Cash basis, job-type profitability, export to CSV.

## License

Private / internal use for Fortified Fence & Weld.
