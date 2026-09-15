import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  deleteGoogleConnection,
  isDemoGoogleConnection,
  loadGoogleConnection,
  syncGoogleWorkspace,
  type GoogleSyncSummary,
} from "./google";
import { loadMhelpdeskConnection, deleteMhelpdeskConnection, syncMhelpdeskJobs, type MhelpdeskSyncResult } from "./mhelpdesk";
import { loadTruesourceConnection, deleteTruesourceConnection, syncTruesourceJobs, type TruesourceSyncResult } from "./truesource";
import { inboxCounts, loadEmailInboxStore, saveEmailInboxStore } from "./email-inbox";
import { loadJobIntakeStore, saveJobIntakeStore } from "./job-intake";
import { isPlaceholderInboxMessage, isPlaceholderIntakeRecord } from "./placeholder-data";
import { isDemoMode } from "../env";

const STALE_MS = 5 * 60 * 1000;

export type SourceSyncSummary = {
  syncedAt: string;
  skipped?: boolean;
  gmail?: GoogleSyncSummary;
  mhelpdesk?: MhelpdeskSyncResult;
  truesource?: TruesourceSyncResult;
  jobs: { total: number; imported: number };
  inbox: { total: number; counts: Record<string, number> };
  message: string;
};

function integrationDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

function summaryPath() {
  return path.join(integrationDir(), "source-last-sync.json");
}

async function ensureDir() {
  await mkdir(integrationDir(), { recursive: true });
}

export async function loadLastSourceSync(): Promise<SourceSyncSummary | null> {
  try {
    const raw = await readFile(summaryPath(), "utf8");
    return JSON.parse(raw) as SourceSyncSummary;
  } catch {
    return null;
  }
}

export async function saveLastSourceSync(summary: SourceSyncSummary) {
  await ensureDir();
  await writeFile(summaryPath(), JSON.stringify(summary, null, 2), { mode: 0o600 });
  return summary;
}

async function snapshotCounts(imported: number, extraMessage?: string): Promise<SourceSyncSummary> {
  const [intake, inbox] = await Promise.all([loadJobIntakeStore(), loadEmailInboxStore()]);
  return {
    syncedAt: new Date().toISOString(),
    jobs: { total: intake.records.length, imported },
    inbox: { total: inbox.messages.length, counts: inboxCounts(inbox.messages) },
    message: extraMessage || "Sources synced.",
  };
}

export async function dropPlaceholderLocalData() {
  if (isDemoMode()) return false;
  let changed = false;
  const google = await loadGoogleConnection();
  if (isDemoGoogleConnection(google)) {
    await deleteGoogleConnection();
    changed = true;
  }
  const mhelpdesk = await loadMhelpdeskConnection();
  if (mhelpdesk?.email?.endsWith("@fortified.local")) {
    await deleteMhelpdeskConnection();
    changed = true;
  }
  const truesource = await loadTruesourceConnection();
  if (truesource?.email?.endsWith("@fortified.local")) {
    await deleteTruesourceConnection();
    changed = true;
  }
  const intake = await loadJobIntakeStore();
  const liveIntake = intake.records.filter((record) => !isPlaceholderIntakeRecord(record));
  if (liveIntake.length !== intake.records.length) {
    await saveJobIntakeStore({ ...intake, records: liveIntake });
    changed = true;
  }
  const inbox = await loadEmailInboxStore();
  const liveInbox = inbox.messages.filter((message) => !isPlaceholderInboxMessage(message));
  if (liveInbox.length !== inbox.messages.length) {
    await saveEmailInboxStore({ ...inbox, messages: liveInbox });
    changed = true;
  }
  return changed;
}

export async function syncAllJobSources(options?: { force?: boolean }): Promise<SourceSyncSummary> {
  const purged = await dropPlaceholderLocalData();
  const last = await loadLastSourceSync();
  if (!purged && !options?.force && last?.syncedAt && Date.now() - Date.parse(last.syncedAt) < STALE_MS) {
    return { ...last, skipped: true };
  }

  const [google, mhelpdesk, truesource] = await Promise.all([
    loadGoogleConnection(),
    loadMhelpdeskConnection(),
    loadTruesourceConnection(),
  ]);

  let gmailSummary: GoogleSyncSummary | undefined;
  let mhelpResult: MhelpdeskSyncResult | undefined;
  let trueResult: TruesourceSyncResult | undefined;
  let imported = 0;
  const notes: string[] = [];

  if (google) {
    try {
      gmailSummary = await syncGoogleWorkspace();
      imported += gmailSummary.jobIntake?.imported ?? 0;
      notes.push(
        `Inbox scanned ${gmailSummary.inbox?.scanned ?? gmailSummary.gmail.messages.length} messages.`
      );
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "Gmail sync failed.");
    }
  }

  if (mhelpdesk) {
    try {
      mhelpResult = await syncMhelpdeskJobs({ includeGmail: false });
      imported += mhelpResult.imported;
      if (mhelpResult.message) notes.push(mhelpResult.message);
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "mHelpDesk sync failed.");
    }
  }

  if (truesource) {
    try {
      trueResult = await syncTruesourceJobs({ includeGmail: false });
      imported += trueResult.imported;
      if (trueResult.message) notes.push(trueResult.message);
    } catch (error) {
      notes.push(error instanceof Error ? error.message : "TrueSource sync failed.");
    }
  }

  if (!google && !mhelpdesk && !truesource) {
    const empty = await snapshotCounts(
      0,
      "Sign in with your real Gmail account or log in to mHelpDesk / Affiliate Connect. Sample jobs are not used in live mode."
    );
    await saveLastSourceSync(empty);
    return empty;
  }

  const summary: SourceSyncSummary = {
    ...(await snapshotCounts(imported, notes.join(" ") || "Sources synced.")),
    gmail: gmailSummary,
    mhelpdesk: mhelpResult,
    truesource: trueResult,
  };
  await saveLastSourceSync(summary);
  return summary;
}
