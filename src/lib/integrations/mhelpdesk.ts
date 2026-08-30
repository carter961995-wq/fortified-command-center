import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import type { JobIntakeRecord, MhelpdeskFieldMap } from "./job-intake";
import { upsertJobIntakeFromSource } from "./job-intake";

export type MhelpdeskConnection = {
  provider: "mhelpdesk";
  baseUrl: string;
  email: string;
  /** Stored locally for browser-session sync. Prefer env/secret managers in production. */
  password?: string;
  connectedAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  mode: "email_bridge" | "session_sync" | "manual";
  notes?: string;
};

export type MhelpdeskSyncResult = {
  syncedAt: string;
  mode: MhelpdeskConnection["mode"];
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
  return path.join(integrationDir(), "mhelpdesk-connection.json");
}

async function ensureDir() {
  await mkdir(integrationDir(), { recursive: true });
}

export async function loadMhelpdeskConnection(): Promise<MhelpdeskConnection | null> {
  try {
    const raw = await readFile(connectionPath(), "utf8");
    return JSON.parse(raw) as MhelpdeskConnection;
  } catch {
    return null;
  }
}

export async function saveMhelpdeskConnection(connection: MhelpdeskConnection) {
  await ensureDir();
  await writeFile(connectionPath(), JSON.stringify(connection, null, 2), { mode: 0o600 });
  return connection;
}

export async function deleteMhelpdeskConnection() {
  await rm(connectionPath(), { force: true });
}

/**
 * mHelpDesk does not expose a reliable public webhook API for every tenant.
 * Supported paths in this app:
 * 1) email_bridge — watch Gmail for mHelpDesk assignment emails (recommended first)
 * 2) session_sync — reserved for authenticated dashboard polling once tenant credentials are available
 * 3) manual — paste/import job text into Job Intake
 */
export async function syncMhelpdeskJobs(): Promise<MhelpdeskSyncResult> {
  const connection = await loadMhelpdeskConnection();
  const syncedAt = new Date().toISOString();

  if (!connection) {
    return {
      syncedAt,
      mode: "manual",
      imported: 0,
      message: "mHelpDesk is not connected. Use Gmail bridge or save credentials in Settings.",
      jobs: [],
    };
  }

  if (connection.mode === "email_bridge") {
    return {
      syncedAt,
      mode: "email_bridge",
      imported: 0,
      message: "Email bridge mode is active. Run Google Workspace sync to import mHelpDesk assignment emails.",
      jobs: [],
    };
  }

  if (connection.mode === "session_sync") {
    // Placeholder until tenant-specific session/API access is configured.
    // Intentionally does not scrape live sites without an approved integration path.
    const demoBody = `mHelpDesk dashboard alert

Customer: ${connection.email.split("@")[0] || "Facility Client"}
Store #: 2201
Location: Distribution Center Dock B
Address: 400 Industrial Blvd
City: Fort Worth
State: TX
Zip: 76102
Work Order #: MHD-${Date.now().toString().slice(-6)}
Description: Gate operator intermittent fault
Details: Operator reverses mid-cycle. Check photo eyes and limit settings.
DNE: $1200.00
Timeframe: Next available business day
Priority: Urgent
Contact: Facilities Desk
Email: facilities@example.com`;

    const sourceRef = `mhelpdesk-demo-${new Date().toISOString().slice(0, 10)}`;
    const { record, created } = await upsertJobIntakeFromSource({
      source: "mhelpdesk",
      sourceRef,
      subject: "mHelpDesk · New job alert",
      from: connection.email,
      snippet: "New job or alert added to mHelpDesk dashboard",
      rawText: demoBody,
    });

    const updated = {
      ...connection,
      lastSyncAt: syncedAt,
      updatedAt: syncedAt,
    };
    await saveMhelpdeskConnection(updated);

    return {
      syncedAt,
      mode: "session_sync",
      imported: created ? 1 : 0,
      message: created
        ? "Imported a sample mHelpDesk-style alert into Job Intake. Replace session_sync with your tenant connector when available."
        : "No new mHelpDesk jobs found (sample alert already imported today).",
      jobs: [
        {
          sourceRef: record.sourceRef,
          title: record.parsed.description || record.subject || "mHelpDesk job",
        },
      ],
    };
  }

  return {
    syncedAt,
    mode: "manual",
    imported: 0,
    message: "Manual mode: paste job text on the Job Intake page.",
    jobs: [],
  };
}

export function prepareMhelpdeskPushPayload(record: JobIntakeRecord): MhelpdeskFieldMap {
  return (
    record.mhelpdeskPush?.fieldMap ?? {
      workOrderNumber: record.parsed.workOrderNumber,
      storeNumber: record.parsed.storeNumber,
      location: record.parsed.locationName,
      address: [record.parsed.address, record.parsed.city, record.parsed.state, record.parsed.zip]
        .filter(Boolean)
        .join(", "),
      description: record.parsed.description,
      jobDetails: record.parsed.jobDetails,
      dneAmount: record.parsed.dneAmount ?? null,
      scheduledDate: record.scheduledDate ?? null,
      notes: record.notes,
      timeframe: record.parsed.timeframe,
    }
  );
}

/**
 * Push notes/schedule/details into mHelpDesk field mapping.
 * Until a tenant API/session connector is configured, this stages the correctly
 * shaped payload for review and marks the record ready.
 */
export async function stageMhelpdeskPush(record: JobIntakeRecord) {
  const connection = await loadMhelpdeskConnection();
  const fieldMap = prepareMhelpdeskPushPayload(record);
  if (!connection) {
    return {
      status: "needs_connection" as const,
      fieldMap,
      error: "Connect mHelpDesk in Settings before pushing updates.",
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    status: "ready" as const,
    fieldMap,
    updatedAt: new Date().toISOString(),
  };
}
