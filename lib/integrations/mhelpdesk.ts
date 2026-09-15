import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import type { JobIntakeRecord, MhelpdeskFieldMap } from "./job-intake";
import { upsertJobIntakeFromSource } from "./job-intake";
import { isDemoMode } from "../env";
import { currentMhelpdeskWorkOrders, pullMhelpdeskLiveJobs, type PortalJobDraft } from "./portal-jobs";

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
  updated: number;
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

async function importPortalJobs(source: "mhelpdesk", drafts: PortalJobDraft[]) {
  let imported = 0;
  let updated = 0;
  const jobs: Array<{ sourceRef: string; title: string }> = [];
  for (const draft of drafts) {
    const { record, created } = await upsertJobIntakeFromSource({
      source,
      sourceRef: draft.sourceRef,
      subject: draft.subject,
      from: draft.from,
      snippet: draft.snippet,
      rawText: draft.rawText,
      parsed: draft.parsed,
    });
    if (created) imported += 1;
    else updated += 1;
    jobs.push({
      sourceRef: record.sourceRef,
      title: record.parsed.description || record.subject || "mHelpDesk job",
    });
  }
  return { imported, updated, jobs };
}

async function pullMhelpdeskDashboard(connection: MhelpdeskConnection) {
  if (isDemoMode()) {
    return { jobs: currentMhelpdeskWorkOrders(connection.email), warning: undefined as string | undefined };
  }
  return pullMhelpdeskLiveJobs({
    baseUrl: connection.baseUrl,
    email: connection.email,
    password: connection.password,
  });
}

async function syncGmailBridge() {
  const { loadGoogleConnection, syncGoogleWorkspace } = await import("./google");
  const google = await loadGoogleConnection();
  if (!google) return null;
  return syncGoogleWorkspace();
}

/**
 * Pull current mHelpDesk work orders.
 * Live path: Gmail assignment/ITB mail plus any JSON dashboard the tenant exposes.
 * Demo path: current-board snapshot so the shop can see the organizer working.
 */
export async function syncMhelpdeskJobs(options?: { includeGmail?: boolean }): Promise<MhelpdeskSyncResult> {
  const connection = await loadMhelpdeskConnection();
  const syncedAt = new Date().toISOString();

  if (!connection) {
    return {
      syncedAt,
      mode: "manual",
      imported: 0,
      updated: 0,
      message: "mHelpDesk is not connected. Log in on Job Sources with your real dashboard email, or connect Gmail.",
      jobs: [],
    };
  }

  if (connection.mode === "manual") {
    return {
      syncedAt,
      mode: "manual",
      imported: 0,
      updated: 0,
      message: "Manual mode: paste job text on the Job Intake page.",
      jobs: [],
    };
  }

  let imported = 0;
  let updated = 0;
  let jobs: Array<{ sourceRef: string; title: string }> = [];
  const notes: string[] = [];

  if (connection.mode === "session_sync" || isDemoMode()) {
    const dashboard = await pullMhelpdeskDashboard(connection);
    if (dashboard.jobs.length) {
      const result = await importPortalJobs("mhelpdesk", dashboard.jobs);
      imported += result.imported;
      updated += result.updated;
      jobs = jobs.concat(result.jobs);
      notes.push(
        isDemoMode()
          ? `Loaded ${result.imported + result.updated} sample mHelpDesk jobs because demo mode is on.`
          : result.imported
            ? `Pulled ${result.imported} live mHelpDesk work order(s) from the dashboard.`
            : `Refreshed ${result.updated} live mHelpDesk work order(s).`
      );
    }
    if (dashboard.warning) notes.push(dashboard.warning);
  }

  if (options?.includeGmail !== false) {
    try {
      const gmail = await syncGmailBridge();
      if (gmail) {
        const gmailImported = gmail.jobIntake?.imported ?? 0;
        imported += gmailImported;
        updated += gmail.jobIntake?.updated ?? 0;
        jobs = jobs.concat(
          (gmail.jobIntake?.records ?? [])
            .filter((record) => /mhelp/i.test(`${record.description ?? ""} ${record.sourceRef}`))
            .map((record) => ({
              sourceRef: record.sourceRef,
              title: record.description || record.workOrderNumber || "mHelpDesk job",
            }))
        );
        notes.push(
          gmailImported > 0
            ? `Gmail imported ${gmailImported} assignment/bid message(s).`
            : "Gmail is connected. No new mHelpDesk assignment emails were found."
        );
      } else if (connection.mode === "email_bridge") {
        notes.push("Connect Gmail so mHelpDesk assignment, bid, and quote emails import automatically.");
      }
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "Gmail sync failed.");
    }
  }

  if (!notes.length) {
    notes.push("mHelpDesk is connected, but no live work orders were imported. Check the dashboard password or connect Gmail.");
  }

  const updatedConnection = { ...connection, lastSyncAt: syncedAt, updatedAt: syncedAt };
  await saveMhelpdeskConnection(updatedConnection);

  return {
    syncedAt,
    mode: connection.mode,
    imported,
    updated,
    message: notes.join(" "),
    jobs,
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
