import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import type { JobIntakeRecord } from "./job-intake";
import { upsertJobIntakeFromSource } from "./job-intake";

export type TruesourceConnection = {
  provider: "truesource";
  portalUrl: string;
  email: string;
  connectedAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  mode: "email_bridge" | "portal_sync" | "manual";
  notes?: string;
};

export type TruesourceSyncResult = {
  syncedAt: string;
  mode: TruesourceConnection["mode"];
  imported: number;
  message: string;
  jobs: Array<{ sourceRef: string; title: string }>;
};

function integrationDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

function connectionPath() {
  return path.join(integrationDir(), "truesource-connection.json");
}

async function ensureDir() {
  await mkdir(integrationDir(), { recursive: true });
}

export async function loadTruesourceConnection(): Promise<TruesourceConnection | null> {
  try {
    const raw = await readFile(connectionPath(), "utf8");
    return JSON.parse(raw) as TruesourceConnection;
  } catch {
    return null;
  }
}

export async function saveTruesourceConnection(connection: TruesourceConnection) {
  await ensureDir();
  await writeFile(connectionPath(), JSON.stringify(connection, null, 2), { mode: 0o600 });
  return connection;
}

export async function deleteTruesourceConnection() {
  await rm(connectionPath(), { force: true });
}

/**
 * TrueSource Affiliate Connect does not publish a stable public API for every tenant.
 * Supported paths:
 * 1) email_bridge — watch Gmail for Affiliate Connect assignment emails
 * 2) portal_sync — reserved for approved tenant credentials
 * 3) manual — paste/import job text into Job Intake
 */
export async function syncTruesourceJobs(): Promise<TruesourceSyncResult> {
  const connection = await loadTruesourceConnection();
  const syncedAt = new Date().toISOString();

  if (!connection) {
    return {
      syncedAt,
      mode: "manual",
      imported: 0,
      message: "TrueSource is not connected. Use Gmail bridge or paste an Affiliate Connect assignment into Job Intake.",
      jobs: [],
    };
  }

  if (connection.mode === "email_bridge") {
    return {
      syncedAt,
      mode: "email_bridge",
      imported: 0,
      message: "Email bridge mode is active. Run Google Workspace sync to import TrueSource Affiliate Connect assignment emails.",
      jobs: [],
    };
  }

  if (connection.mode === "portal_sync") {
    const demoBody = `TrueSource Affiliate Connect assignment

Customer: National Facilities Network
Store #: 5518
Location: Regional Distribution Hub
Address: 880 Alliance Pkwy
City: Memphis
State: TN
Zip: 38118
Work Order #: TS-77419
PO #: TS-PO-2208
Description: Repair bent ornamental fence at truck court
Details: Two 8ft panels damaged by trailer swing. Replace panels, reset posts if out of plumb, photo before/after required.
DNE: $1450.00
Timeframe: Complete within 3 business days
Due: 08/04/2026
Priority: Urgent
Trade: Fence
Contact: Night Facilities Desk
Phone: (901) 555-0144
Email: night.desk@nfn.example`;

    const sourceRef = `truesource-demo-${new Date().toISOString().slice(0, 10)}`;
    const { record, created } = await upsertJobIntakeFromSource({
      source: "truesource",
      sourceRef,
      subject: "TrueSource Affiliate Connect · New assignment TS-77419",
      from: connection.email,
      snippet: "New Affiliate Connect work order at Regional Distribution Hub",
      rawText: demoBody,
    });

    const updated = {
      ...connection,
      lastSyncAt: syncedAt,
      updatedAt: syncedAt,
    };
    await saveTruesourceConnection(updated);

    return {
      syncedAt,
      mode: "portal_sync",
      imported: created ? 1 : 0,
      message: created
        ? "Imported a TrueSource-style assignment into Job Intake. Replace portal_sync with your tenant connector when credentials are available."
        : "No new TrueSource jobs found (sample assignment already imported today).",
      jobs: [
        {
          sourceRef: record.sourceRef,
          title: record.parsed.description || record.subject || "TrueSource job",
        },
      ],
    };
  }

  return {
    syncedAt,
    mode: "manual",
    imported: 0,
    message: "Manual mode: paste Affiliate Connect job text on the Job Intake page.",
    jobs: [],
  };
}

export function buildTruesourceFieldMap(record: JobIntakeRecord) {
  const p = record.parsed;
  return {
    affiliateWorkOrder: p.workOrderNumber,
    storeNumber: p.storeNumber,
    location: p.locationName || [p.city, p.state].filter(Boolean).join(", "),
    address: [p.address, p.city, p.state, p.zip].filter(Boolean).join(", "),
    description: p.description,
    jobDetails: p.jobDetails,
    nteAmount: p.dneAmount ?? null,
    scheduledDate: record.scheduledDate ?? p.dueDate ?? null,
    notes: record.notes,
    timeframe: p.timeframe,
  };
}
