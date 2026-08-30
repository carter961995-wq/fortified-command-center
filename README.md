# Fortified Command Center

Desktop operations software for **Fortified Fence & Weld**: commercial fence, gate, welding, security grille, bollard, and facilities maintenance for national facility-maintenance accounts.

This is a downloadable Next.js + Electron app. In demo mode it runs with seeded in-memory data — no Supabase required.

## What this product does

- **Work orders and jobs** — track open national-account jobs from intake through dispatch, completion, invoice, and closeout.
- **Job Intake** — paste or sync **mHelpDesk** and **TrueSource Affiliate Connect** assignments, parse store # / WO # / DNE / location / dates, then create a Fortified work order.
- **Dispatch** — turn a Fortified work order into a subcontractor packet (not the national-account form), copy/download it, and log the send.
- **Communications and files** — store emails, texts, call notes, photos, and documents on each work order.
- **Pricing book** — material, subcontractor, equipment, labor, and overhead rates used to quote and cost jobs.
- **Invoices** — Fortified invoice records, payments, and a branded PDF template (customer WO #, PO #, site, scope, line items).
- **Fortified AI** — built-in company assistant for finding jobs, pricing, dispatch wording, and where to click. Uses Gemini when `GEMINI_API_KEY` is set; otherwise answers from live company data in the app.

## What was removed

The repo had two overlapping apps plus leftover “Fence Bible” workspaces (planner, notepad, website extractor, coming-soon pages). Those unused trees were deleted so only the working operations app remains.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo mode starts automatically when Supabase env vars are missing.

## Desktop download

```bash
npm install
npm run desktop:dev          # Electron window against the local Next server
npm run desktop:dist         # Mac package (on a Mac)
```

Packaged Mac files land in `dist-desktop/`. GitHub Actions and Codemagic still build the Mac download.

## Environment

Copy `.env.example` to `.env.local` for live data:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_DEMO_MODE` | `true` forces demo; `false` forces Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Persistent data |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only storage uploads |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail intake |
| `GEMINI_API_KEY` | Job parsing + Fortified AI |
| `FORTIFIED_USER_DATA_DIR` | Local JSON for Google / mHelpDesk / TrueSource / intake |

National-account portals do not all publish a public API. This app intakes from assignment emails, pasted portal text, and staged sync — then converts into Fortified’s own work-order format.

## License

Private / internal use for Fortified Fence & Weld.
