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
- **Fence Builders Bible workspaces**: Planner, leads, Gmail-style inbox, clients, jobs, measurement tool,
  subcontractor map, website extractor, documents, notepad, fence bible, reports, and dedicated invoicing.
- **Job Intake (Gmail + mHelpDesk)**: Watches assignment emails, parses store # / WO # / DNE / location /
  timeframe into a clean job brief, adds jobs to a tracker queue, supports notes + schedule dates, approve-
  before-send Gmail drafts, and stages mHelpDesk field-mapped updates.
- **Automation-ready integrations**: Settings exposes Google Workspace/Gmail, mHelpDesk connection modes,
  Gemini extraction, SMS, and phone-call intake surfaces. Live automation requires real OAuth/API credentials.

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

## Mac desktop download

The app can also be packaged as a Mac desktop app with Electron. The packaged app starts its own private
local Next.js server and opens the dashboard in a desktop window, so the person using it does not need to
run terminal commands.

To test the desktop shell while developing:

```bash
npm install
npm run desktop:dev
```

To produce a Mac download on a Mac:

```bash
npm install
npm run desktop:dist
```

The Mac `.dmg` and `.zip` files are written to `dist-desktop/`.

You can also build the downloadable Mac files from GitHub by running the **Build Mac desktop app** workflow
manually. Its artifact is named `fortified-command-center-mac`.

### Codemagic Mac download

Use the Codemagic workflow named **Fortified Command Center Mac Download** (not the Web Build workflow).

Codemagic only treats some file types as standalone downloads. A bare `.dmg` is packed into a generic
`*_artifacts.zip`, which is easy to mistake for a broken Mac app. This project therefore publishes:

1. A standalone **`.zip`** containing `Fortified Command Center.app` (preferred Codemagic download)
2. The **`.app`** bundle when Codemagic lists it separately
3. The **`.dmg`** (may appear inside the generic artifacts archive)
4. `HOW_TO_OPEN_MAC_BUILD.txt` with open instructions

**How to open the download on a Mac**

1. Download the standalone `.zip` named like `Fortified Command Center-*-mac-*.zip`
2. Double-click to extract `Fortified Command Center.app`
3. If macOS blocks it (unsigned/unnotarized): Finder → right-click the app → **Open** → **Open**
4. If you only see `*_artifacts.zip`, unzip it first — the `.dmg` / instructions are inside

Add the certificate and Apple notarization values below to the `mac_desktop_signing` environment group
for public downloads. If those values are missing, the workflow falls back to an unsigned build and skips
Gatekeeper verification.

Public downloads should be signed and notarized so macOS Gatekeeper lets people open the app normally. To
enable that in GitHub Actions, add these repository secrets:

| Secret | Purpose |
|--------|---------|
| `MACOS_CERTIFICATE` | Base64-encoded Developer ID Application `.p12` certificate for Electron Builder (`CSC_LINK`) |
| `MACOS_CERTIFICATE_PASSWORD` | Password for the `.p12` certificate (`CSC_KEY_PASSWORD`) |
| `APPLE_ID` | Apple Developer account email for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for `APPLE_ID` (`APPLE_ID_PASSWORD` is also accepted) |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

Alternatively, notarization can use App Store Connect API credentials with `APPLE_API_KEY`,
`APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` instead of `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD`.
`APPLE_API_ISSUER_ID` is also accepted as an alias for `APPLE_API_ISSUER`.
`APPLE_API_KEY` may be an absolute path to the `.p8` key, the raw `.p8` contents, or the base64-encoded
`.p8` contents.
For local Mac packaging, `.env.local` is loaded before the desktop signing scripts run. You can use either
Electron Builder's `CSC_LINK` / `CSC_KEY_PASSWORD` names or the GitHub secret-style
`MACOS_CERTIFICATE` / `MACOS_CERTIFICATE_PASSWORD` aliases.
Local desktop builds without these secrets still work for development with `npm run desktop:dist:unsigned`,
but macOS may require right-clicking the app and choosing **Open** the first time.

### Codemagic Windows download

Use the Codemagic workflow named **Fortified Command Center Windows Download** (not the Web Build
workflow and not the Mac Download workflow). It runs on a `windows_x2` machine and publishes:

1. A standalone **`.exe`** NSIS installer (preferred)
2. A standalone **`.zip`** containing `Fortified Command Center.exe`
3. `HOW_TO_OPEN_WINDOWS_BUILD.txt`

**How to open the download on Windows**

1. Download the `.exe` named like `Fortified Command Center-*-win-x64.exe`
2. Double-click to install, or unzip the `.zip` and run `Fortified Command Center.exe`
3. If SmartScreen blocks an unsigned build: **More info → Run anyway**
4. If you only see `*_artifacts.zip`, unzip it first — the installer is inside

This Windows workflow does not require a signing certificate. Add `CSC_LINK` / `CSC_KEY_PASSWORD`
later if you want an Authenticode-signed installer.

To build the Windows package on a Windows PC locally:

```bash
npm install
npm run desktop:dist:win
```

The installer and zip are written to `dist-desktop/`.

## Google Workspace and Gemini connection

Settings includes a one-time **Connect Google** flow. To use it with real Google data:

1. Create a Google Cloud OAuth client.
2. Add the redirect URI shown in Settings.
   - Local dev usually uses `http://localhost:3000/api/integrations/google/callback`.
   - The packaged Mac app uses `http://127.0.0.1:43111/api/integrations/google/callback` by default.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Optional: set `GEMINI_API_KEY` so Workspace sync can extract leads, work orders, contacts, and invoice tasks.

The app requests offline Google access so you sign in once, then it can refresh access for Gmail, Drive
metadata, Calendar, and Contacts sync. Local desktop tokens are stored under the app user-data folder.

## Environment variables

For real persisted data, copy `.env.example` to `.env.local`, replace the placeholders with real Supabase
values, and set `NEXT_PUBLIC_DEMO_MODE=false` if you want to force Supabase mode:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_DEMO_MODE` | Optional. `true` forces demo mode; `false` forces Supabase mode |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key — used in browser and server with user session |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **server only**; used for privileged storage uploads (e.g. invoice PDFs) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google Workspace OAuth app credentials for Gmail ingestion |
| `GOOGLE_REDIRECT_URI` | Optional OAuth callback override. Use `http://localhost:3000/api/integrations/google/callback` for local dev or `http://127.0.0.1:43111/api/integrations/google/callback` for the packaged Mac app |
| `GEMINI_API_KEY` | Optional Gemini key for extracting leads, work orders, contacts, and invoice tasks from messages/documents |
| `GEMINI_MODEL` | Optional Gemini model name; defaults to `gemini-1.5-flash` |
| `TWILIO_*` | Optional SMS/phone intake credentials for text/call workflows |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | Optional Mac desktop signing certificate and password. `MACOS_CERTIFICATE` / `MACOS_CERTIFICATE_PASSWORD` are accepted aliases |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | Optional Apple ID notarization credentials for signed Mac desktop downloads. `APPLE_ID_PASSWORD` is accepted as a password alias |
| `APPLE_API_KEY` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER` | Optional App Store Connect API notarization credentials. `APPLE_API_ISSUER_ID` is accepted as an issuer alias |

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
