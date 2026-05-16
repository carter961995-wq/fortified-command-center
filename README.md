# Fortified Work Order Command Center

Private internal admin dashboard for Fortified Fence & Weld to manage commercial work orders, customers, locations, subcontractors, quotes, invoices, payments, job costs, photos/documents, maintenance contracts, and reporting.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, RLS, and Storage
- Server-side branded invoice PDF generation with `pdf-lib`

## What is included

- Protected admin shell with `/login` and Supabase Auth middleware.
- Core routes:
  - `/dashboard`
  - `/customers`, `/customers/new`, `/customers/[id]`
  - `/locations`, `/locations/new`, `/locations/[id]`
  - `/subcontractors`, `/subcontractors/new`, `/subcontractors/[id]`
  - `/work-orders`, `/work-orders/new`, `/work-orders/[id]`
  - `/quotes`, `/quotes/[id]`
  - `/invoices`, `/invoices/[id]`
  - `/maintenance-contracts`, `/maintenance-contracts/[id]`
  - `/reports`
  - `/settings`
- Work order status lifecycle and automatic status timestamp behavior.
- Job cost entry and work order gross profit / gross margin snapshot.
- Invoice line items, payments, balance/status recalculation, overdue/paid/partial handling.
- Branded invoice PDF at `/api/invoices/[id]/pdf`.
- Supabase Storage upload UI for work order photos and documents.
- Maintenance visits and linked work order creation.
- Dashboard and reports for operational, revenue, profit, aging, and subcontractor views.
- Supabase migration with tables, foreign keys, indexes, updated_at triggers, RLS policies, storage buckets, and business triggers.

## Environment variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not expose it to browser code or commit real secrets.

## Supabase setup

1. Create a Supabase project.
2. Apply the migration in `supabase/migrations/20260516021200_initial_schema.sql` using the Supabase SQL editor or CLI.
3. Create an Auth user for the owner/admin.
4. Insert that user's profile row:

```sql
insert into public.users_profile (auth_user_id, full_name, email, role)
values ('<auth.users.id>', 'Owner Name', 'owner@example.com', 'owner');
```

5. Optional: run `supabase/seed.sql` for demo customer/location/subcontractor records.

## Run locally

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Database notes

- Financial records use restrictive foreign keys to avoid accidental destructive cascade deletes.
- `work_orders` status timestamps are enforced both in server actions and database triggers.
- `invoice_line_items` and `payments` recalculate invoice totals, amount paid, balance due, and paid/partial/overdue status.
- RLS grants owner/admin/dispatcher staff access for the internal MVP.
- Future-ready policies allow customers to select their records by email and subcontractors to select assigned work orders by email.

## Known limitations

- Stripe and QuickBooks are intentionally not implemented yet.
- Customer and subcontractor portals are intentionally not built; policies are prepared for later scoped access.
- Generated Supabase types should be regenerated from the live project after the migration is applied.
- File buckets are public for straightforward MVP document/photo access; change to signed URLs if stricter document privacy is required.
