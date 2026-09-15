import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { upsertJobIntakeFromSource } from "./job-intake";
import { isDemoMode } from "../env";
import { currentTruesourceWorkOrders, pullTruesourceLiveJobs, type PortalJobDraft } from "./portal-jobs";

export type TruesourceConnection = {
  provider: "truesource";
  baseUrl: string;
  email: string;
  password?: string;
  connectedAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  mode: "email_bridge" | "session_sync" | "manual";
  notes?: string;
};

export type TruesourceSyncResult = {
  syncedAt: string;
  mode: TruesourceConnection["mode"];
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

async function importPortalJobs(drafts: PortalJobDraft[]) {
  let imported = 0;
  let updated = 0;
  const jobs: Array<{ sourceRef: string; title: string }> = [];
  for (const draft of drafts) {
    const { record, created } = await upsertJobIntakeFromSource({
      source: "truesource",
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
      title: record.parsed.description || record.subject || "TrueSource job",
    });
  }
  return { imported, updated, jobs };
}

async function pullTruesourceDashboard(connection: TruesourceConnection) {
  if (isDemoMode()) {
    return { jobs: currentTruesourceWorkOrders(connection.email), warning: undefined as string | undefined };
  }
  return pullTruesourceLiveJobs({
    email: connection.email,
    password: connection.password,
  });
}

export async function syncTruesourceJobs(options?: { includeGmail?: boolean }): Promise<TruesourceSyncResult> {
  const connection = await loadTruesourceConnection();
  const syncedAt = new Date().toISOString();

  if (!connection) {
    return {
      syncedAt,
      mode: "manual",
      imported: 0,
      updated: 0,
      message: "TrueSource is not connected. Log in to Affiliate Connect on Job Sources, or connect Gmail.",
      jobs: [],
    };
  }

  if (connection.mode === "manual") {
    return {
      syncedAt,
      mode: "manual",
      imported: 0,
      updated: 0,
      message: "Manual mode: paste Affiliate Connect job text on the Job Intake page.",
      jobs: [],
    };
  }

  let imported = 0;
  let updated = 0;
  let jobs: Array<{ sourceRef: string; title: string }> = [];
  const notes: string[] = [];

  if (connection.mode === "session_sync" || isDemoMode()) {
    const dashboard = await pullTruesourceDashboard(connection);
    if (dashboard.jobs.length) {
      const result = await importPortalJobs(dashboard.jobs);
      imported += result.imported;
      updated += result.updated;
      jobs = jobs.concat(result.jobs);
      notes.push(
        isDemoMode()
          ? `Loaded ${result.imported + result.updated} sample Affiliate Connect jobs because demo mode is on.`
          : result.imported
            ? `Pulled ${result.imported} live Affiliate Connect work order(s).`
            : `Refreshed ${result.updated} live Affiliate Connect work order(s).`
      );
    }
    if (dashboard.warning) notes.push(dashboard.warning);
  }

  if (options?.includeGmail !== false) {
    try {
      const google = await (await import("./google")).loadGoogleConnection();
      if (google) {
        const { syncGoogleWorkspace } = await import("./google");
        const summary = await syncGoogleWorkspace();
        const gmailImported = summary.jobIntake?.imported ?? 0;
        imported += gmailImported;
        updated += summary.jobIntake?.updated ?? 0;
        jobs = jobs.concat(
          (summary.jobIntake?.records ?? []).map((record) => ({
            sourceRef: record.sourceRef,
            title: record.description || record.workOrderNumber || "TrueSource job",
          }))
        );
        notes.push(
          gmailImported > 0
            ? `Gmail imported ${gmailImported} assignment/bid message(s).`
            : "Gmail is connected. No new Affiliate Connect emails were found."
        );
      } else if (connection.mode === "email_bridge") {
        notes.push("Connect Gmail so Affiliate Connect assignment, bid, and quote emails import automatically.");
      }
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "Gmail sync failed.");
    }
  }

  if (!notes.length) {
    notes.push("TrueSource is connected, but no live work orders were imported. Check the Affiliate Connect password or connect Gmail.");
  }

  const updatedConnection = { ...connection, lastSyncAt: syncedAt, updatedAt: syncedAt };
  await saveTruesourceConnection(updatedConnection);

  return {
    syncedAt,
    mode: connection.mode,
    imported,
    updated,
    message: notes.join(" "),
    jobs,
  };
}
