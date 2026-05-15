# Fortified Work Order Command Center

Private internal admin dashboard for **Fortified Fence & Weld** to manage commercial fence, gate, welding, security grille, bollard, facilities-maintenance, subcontractor dispatch, invoices, job costs, profit tracking, and recurring maintenance contracts across multiple states.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase** (PostgreSQL, Auth, RLS)
- **@react-pdf/renderer** (server-side invoice PDF generation)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd fortified-command-center
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

3. Run the migration in `supabase/migrations/001_initial_schema.sql` against your database (Supabase SQL Editor or CLI).

4. Create a user in Supabase Auth (Dashboard > Authentication > Users).

### 3. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sign in.

## Modules

| Module | Route | Status |
|---|---|---|
| Dashboard | `/` | Metrics cards (live when connected) |
| Customers | `/customers` | Full CRUD |
| Locations | `/locations` | Full CRUD, linked to customers |
| Subcontractors | `/subcontractors` | Full CRUD with compliance tracking |
| Work Orders | `/work-orders` | Full CRUD, lifecycle management |
| Job Costs | `/job-costs` | Add/track costs per work order |
| Quotes | `/quotes` | Create from work orders, line items |
| Invoices | `/invoices` | Create from work orders, line items |
| Invoice PDF | `/invoices/[id]/pdf` | Fortified-branded PDF generation |
| Payments | `/payments` | Record payments against invoices |
| Maintenance Contracts | `/maintenance-contracts` | Recurring contract management |
| Maintenance Visits | `/maintenance-visits` | Visit tracking |
| Reports | `/reports` | Business performance overview |
| Settings | `/settings` | System configuration |

## Work Order Lifecycle

```
New → Needs Site Info → Waiting on Sub Quote → Quote Needed → Quote Sent →
Approved → Scheduled → In Progress → Completed by Sub → Needs Review →
Ready to Invoice → Invoiced → Paid → Closed
```

Additional statuses: `Callback/Warranty`, `Cancelled`

## Business Logic

For every work order:
- `gross_profit = invoice_total - total_job_costs`
- `gross_margin = gross_profit / invoice_total × 100`

Job cost categories: Subcontractor, Materials, Equipment, Travel, Permit, Other

## Invoice PDF

Server-side generated using `@react-pdf/renderer`. Features:
- Fortified Fence & Weld branded header (dark bar)
- Phone: (318) 446-2134
- Large INVOICE label
- Bill To / Job Location blocks
- Invoice details grid (number, date, due date, terms)
- Customer WO # / PO # if applicable
- Service summary / work scope
- Description/Qty/Price/Amount table
- Subtotal, tax, total due
- Payment terms (default Net 14)
- Notes section
- Professional footer with "Thank you for your business. Page 1"

## Database

Full schema in `supabase/migrations/001_initial_schema.sql`. Tables:
- `customers`, `locations`, `subcontractors`
- `work_orders`, `job_costs`
- `quotes`, `quote_items`
- `invoices`, `invoice_items`
- `payments`
- `maintenance_contracts`, `maintenance_visits`
- `documents`

All tables have RLS enabled with admin-only policies. Auto-updating `updated_at` triggers on all mutable tables.

## Future

- Stripe integration (payment processing)
- QuickBooks sync (accounting)
- Supabase Storage (photo/document uploads)
- Customer/subcontractor portals
