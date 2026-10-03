import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isDemoMode } from "../env.ts";
import { brandedWorkOrderSubject, writeBrandedWorkOrderPdf } from "./branded-work-order.ts";
import {
  matchContractor,
  toContractorCandidate,
  type ContractorCandidate,
  type DispatchRoute,
  type JobLocation,
} from "./contractor-match.ts";

export type { ContractorCandidate, DispatchRoute } from "./contractor-match.ts";
import { isImageFile, mergeIntakeFiles, type IntakeFile } from "./intake-files.ts";
import {
  buildDefaultEmailDraft,
  getJobIntakeRecord,
  loadJobIntakeStore,
  updateJobIntakeRecord,
  intakeToWorkOrderDraft,
  type JobDispatch,
  type JobEmailDraft,
  type JobIntakeRecord,
} from "./job-intake.ts";
import { approvalStillMatches } from "./dispatch-approval.ts";
import { withFileLock } from "../file-lock.ts";
import { formatMoney, redactSubcontractorDne, subcontractorDneAmount } from "./subcontractor-dne.ts";

export type { JobDispatch };
export type DispatchStatus = JobDispatch["status"];

export type DispatchMonitorState = {
  enabled: boolean;
  autoSend: boolean;
  intervalMs: number;
  startedAt?: string;
  lastTickAt?: string;
  lastError?: string;
  lastResult?: DispatchCycleResult;
};

export type DispatchCycleResult = {
  ranAt: string;
  synced: boolean;
  checked: number;
  assigned: number;
  sent: number;
  pendingReview: number;
  needsContractor: number;
  skipped: number;
  message: string;
  items: Array<{
    intakeId: string;
    workOrderNumber?: string;
    status: DispatchStatus | "skipped";
    contractorName?: string;
    fortifiedWorkOrderNumber?: string;
    detail: string;
  }>;
};

const DEFAULT_INTERVAL_MS = 90_000;
const MIN_INTERVAL_MS = 30_000;

function integrationDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

function statePath() {
  return path.join(integrationDir(), "dispatch-monitor.json");
}

function routesPath() {
  return path.join(integrationDir(), "dispatch-routes.json");
}

function documentsDir() {
  return path.join(integrationDir(), "branded-work-orders");
}

async function ensureDir() {
  await mkdir(integrationDir(), { recursive: true });
}

export function defaultMonitorState(): DispatchMonitorState {
  return {
    enabled: process.env.FORTIFIED_DISPATCH_MONITOR !== "off",
    autoSend: false,
    intervalMs: DEFAULT_INTERVAL_MS,
  };
}

export async function loadDispatchMonitorState(): Promise<DispatchMonitorState> {
  try {
    const raw = await readFile(statePath(), "utf8");
    const parsed = JSON.parse(raw) as DispatchMonitorState;
    return {
      ...defaultMonitorState(),
      ...parsed,
      autoSend: false,
      intervalMs: Math.max(MIN_INTERVAL_MS, Number(parsed.intervalMs) || DEFAULT_INTERVAL_MS),
    };
  } catch {
    return defaultMonitorState();
  }
}

export async function saveDispatchMonitorState(state: DispatchMonitorState) {
  await ensureDir();
  await writeFile(statePath(), JSON.stringify(state, null, 2), { mode: 0o600 });
  return state;
}

export async function loadDispatchRoutes(): Promise<DispatchRoute[]> {
  try {
    const raw = await readFile(routesPath(), "utf8");
    const parsed = JSON.parse(raw) as { routes?: DispatchRoute[] };
    return Array.isArray(parsed.routes) ? parsed.routes : [];
  } catch {
    return [];
  }
}

export async function saveDispatchRoutes(routes: DispatchRoute[]) {
  await ensureDir();
  await writeFile(routesPath(), JSON.stringify({ updatedAt: new Date().toISOString(), routes }, null, 2), {
    mode: 0o600,
  });
  return routes;
}

export function normalizeDispatchRoute(input: Partial<DispatchRoute> & { subcontractorId: string }): DispatchRoute {
  const split = (value: unknown) =>
    (Array.isArray(value) ? value : String(value ?? "").split(","))
      .map((item) => String(item).trim())
      .filter(Boolean);
  return {
    id: input.id || randomUUID(),
    label: String(input.label || "Location route").trim() || "Location route",
    states: split(input.states).map((state) => state.toUpperCase()),
    cities: split(input.cities),
    zipPrefixes: split(input.zipPrefixes),
    trades: split(input.trades),
    subcontractorId: input.subcontractorId,
    active: input.active !== false,
  };
}

function jobLocation(record: JobIntakeRecord): JobLocation {
  return {
    city: record.parsed.city,
    state: record.parsed.state,
    zip: record.parsed.zip,
    tradeType: record.parsed.tradeType,
  };
}

function shouldDispatch(record: JobIntakeRecord) {
  return record.category === "work_order" || record.category === "approved_quote";
}

function nextFortifiedNumber(records: JobIntakeRecord[]) {
  const year = new Date().getFullYear();
  const prefix = `FFW-${year}-`;
  let max = 0;
  for (const record of records) {
    const value = record.dispatch?.fortifiedWorkOrderNumber || "";
    if (!value.startsWith(prefix)) continue;
    const number = Number(value.slice(prefix.length));
    if (Number.isFinite(number)) max = Math.max(max, number);
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function deliverableEmail(email?: string) {
  if (!email) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (isDemoMode()) return true;
  return !/@example\./i.test(email) && !/\.example$/i.test(email.split("@")[1] || "");
}

async function loadContractors(): Promise<ContractorCandidate[]> {
  try {
    const { createSupabaseServerClient } = await import("../supabase/server.ts");
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from("subcontractors").select("*");
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(toContractorCandidate).filter((row) => row.id);
  } catch {
    const { createLocalDataClient } = await import("../../src/lib/demo-client.ts");
    const client = createLocalDataClient({ seed: isDemoMode() });
    const { data } = await client.from("subcontractors").select("*");
    return ((data ?? []) as Record<string, unknown>[]).map(toContractorCandidate).filter((row) => row.id);
  }
}

async function insertAssignedWorkOrder(record: JobIntakeRecord, dispatch: JobDispatch) {
  if (record.workOrderId && !record.workOrderId.startsWith("local-")) return record.workOrderId;
  if (dispatch.workOrderId && !dispatch.workOrderId.startsWith("local-")) return dispatch.workOrderId;
  const draft = intakeToWorkOrderDraft(record);
  const row = {
    ...draft,
    status: "Scheduled",
    source: draft.source === "Email" ? "Email" : "Other",
    subcontractor_id: dispatch.contractorId,
    work_order_number: dispatch.fortifiedWorkOrderNumber,
    internal_notes: [
      draft.internal_notes,
      `Fortified WO ${dispatch.fortifiedWorkOrderNumber}`,
      dispatch.contractorName ? `Assigned to ${dispatch.contractorName}` : null,
      record.parsed.dneAmount != null
        ? `Customer DNE ${formatMoney(record.parsed.dneAmount)}. Subcontractor NTE ${formatMoney(subcontractorDneAmount(record.parsed.dneAmount))}.`
        : null,
      dispatch.reason,
    ]
      .filter(Boolean)
      .join("\n"),
  };

  const persist = async (client: { from: (table: string) => any }) => {
    const inserted = await client.from("work_orders").insert(row).select("id").maybeSingle();
    const id = inserted?.data?.id ? String(inserted.data.id) : null;
    if (!id) return null;
    for (const file of record.files ?? []) {
      const url = file.localPath || file.sourceUrl;
      if (!url) continue;
      if (isImageFile(file)) {
        await client.from("work_order_photos").insert({
          work_order_id: id,
          photo_url: url,
          photo_type: "other",
          caption: file.name,
        });
      } else {
        await client.from("work_order_documents").insert({
          work_order_id: id,
          document_url: url,
          document_type: "other",
          filename: file.name,
        });
      }
    }
    if (dispatch.documentPath) {
      await client.from("work_order_documents").insert({
        work_order_id: id,
        document_url: dispatch.documentPath,
        document_type: "other",
        filename: `${dispatch.fortifiedWorkOrderNumber}.pdf`,
      });
    }
    return id;
  };

  try {
    const { createSupabaseServerClient } = await import("../supabase/server.ts");
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const id = await persist(supabase);
      if (id) return id;
    }
  } catch {
    /* Fall through to the local store when this is not running inside Next. */
  }

  const { createLocalDataClient } = await import("../../src/lib/demo-client.ts");
  const client = createLocalDataClient({ seed: false });
  return persist(client);
}

async function attachDownloadedFiles(record: JobIntakeRecord) {
  const pending = (record.files ?? []).filter((file) => file.source === "gmail" && file.attachmentId && !file.localPath);
  if (!pending.length) return record.files ?? [];
  try {
    const { downloadGmailAttachments } = await import("./google.ts");
    const saved = await downloadGmailAttachments(pending);
    return mergeIntakeFiles(record.files, saved);
  } catch {
    return record.files ?? [];
  }
}

async function sendAssignment(input: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  files: IntakeFile[];
  pdfPath?: string;
}) {
  const { sendApprovedGmailDraft } = await import("./google.ts");
  const attachments: Array<{ filename: string; mimeType: string; content: Buffer }> = [];
  if (input.pdfPath) {
    const { readFile } = await import("node:fs/promises");
    attachments.push({
      filename: path.basename(input.pdfPath),
      mimeType: "application/pdf",
      content: await readFile(input.pdfPath),
    });
  }
  for (const file of input.files) {
    if (!file.localPath || !isImageFile(file)) continue;
    if (attachments.length >= 8) break;
    const { readFile } = await import("node:fs/promises");
    attachments.push({
      filename: file.name,
      mimeType: file.mimeType || "application/octet-stream",
      content: await readFile(file.localPath),
    });
  }
  return sendApprovedGmailDraft({
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    body: input.body,
    attachments,
  });
}

type OutboundEmail = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  files: IntakeFile[];
  pdfPath?: string;
};

export async function dispatchIncomingWorkOrders(options?: {
  contractors?: ContractorCandidate[];
  routes?: DispatchRoute[];
}): Promise<DispatchCycleResult> {
  const store = await loadJobIntakeStore();
  const routes = options?.routes ?? (await loadDispatchRoutes());
  const contractors = options?.contractors ?? (await loadContractors());
  const items: DispatchCycleResult["items"] = [];
  const assigned = 0;
  const sent = 0;
  let pendingReview = 0;
  let needsContractor = 0;
  let skipped = 0;
  const numbers = store.records.map((record) => ({ ...record }));

  for (const record of store.records) {
    if (!shouldDispatch(record)) {
      skipped += 1;
      continue;
    }
    const current = record.dispatch;
    if (current?.status === "sent" || current?.status === "pending_review") {
      skipped += 1;
      continue;
    }
    if (current?.status === "assigned" && !current.error) {
      skipped += 1;
      continue;
    }
    if (
      current?.status === "assigned" &&
      current.error &&
      /sample address|has no email/i.test(current.error)
    ) {
      skipped += 1;
      continue;
    }

    const files = await attachDownloadedFiles(record);
    if (files.length) {
      await updateJobIntakeRecord(record.id, { files, photoUrls: files.map((file) => file.localPath || file.sourceUrl || file.name) });
    }

    const existingNumber = current?.fortifiedWorkOrderNumber;
    const match = matchContractor(jobLocation(record), routes, contractors);
    if (!match) {
      const where = [record.parsed.city, record.parsed.state].filter(Boolean).join(", ") || "an unknown location";
      const dispatch: JobDispatch = {
        status: "needs_contractor",
        fortifiedWorkOrderNumber: existingNumber,
        reason: `No predetermined contractor covers ${where}. Add a dispatch route or set service states on an active subcontractor.`,
        updatedAt: new Date().toISOString(),
      };
      await updateJobIntakeRecord(record.id, { dispatch, files });
      needsContractor += 1;
      items.push({
        intakeId: record.id,
        workOrderNumber: record.parsed.workOrderNumber,
        status: "needs_contractor",
        detail: dispatch.reason || "",
      });
      continue;
    }

    const fortifiedWorkOrderNumber = existingNumber || nextFortifiedNumber(numbers);
    const assignment = {
      fortifiedWorkOrderNumber,
      contractorName: match.contractor.companyName,
      contractorEmail: match.contractor.email,
      contractorPhone: match.contractor.phone,
      reason: match.reason,
    };
    const written = await writeBrandedWorkOrderPdf({
      directory: documentsDir(),
      record: { ...record, files },
      assignment,
      files,
    });
    numbers.push({
      ...record,
      dispatch: { status: "assigned", fortifiedWorkOrderNumber, updatedAt: new Date().toISOString() },
    });

    const dispatch: JobDispatch = {
      status: "pending_review",
      contractorId: match.contractor.id,
      contractorName: match.contractor.companyName,
      contractorEmail: match.contractor.email,
      contractorPhone: match.contractor.phone,
      reason: `${match.reason} Waiting for review before the crew is assigned or emailed.`,
      routeId: match.routeId,
      fortifiedWorkOrderNumber,
      documentPath: written.pdfPath,
      updatedAt: new Date().toISOString(),
    };
    pendingReview += 1;

    await updateJobIntakeRecord(record.id, {
      files,
      photoUrls: files.map((file) => file.localPath || file.sourceUrl || file.name),
      dispatch,
      emailDraft: {
        to: match.contractor.email || "",
        subject: brandedWorkOrderSubject(record, assignment),
        body: written.text,
        status: "draft",
        updatedAt: new Date().toISOString(),
      },
    });

    items.push({
      intakeId: record.id,
      workOrderNumber: record.parsed.workOrderNumber,
      status: dispatch.status,
      contractorName: dispatch.contractorName,
      fortifiedWorkOrderNumber,
      detail: dispatch.error || dispatch.reason || "",
    });
  }

  const message = [
    `Checked ${store.records.length} intake records.`,
    pendingReview ? `Held ${pendingReview} for review.` : null,
    assigned ? `Assigned ${assigned}.` : null,
    sent ? `Sent ${sent} branded work order${sent === 1 ? "" : "s"}.` : null,
    needsContractor ? `${needsContractor} need a contractor for that location.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ranAt: new Date().toISOString(),
    synced: false,
    checked: store.records.length,
    assigned,
    sent,
    pendingReview,
    needsContractor,
    skipped,
    message,
    items,
  };
}

export async function releaseReviewedDispatch(
  intakeId: string,
  options?: {
    to?: string;
    cc?: string;
    subject?: string;
    body?: string;
    sendEmail?: (input: OutboundEmail) => Promise<{ id: string }>;
  }
) {
  return withFileLock(`dispatch-${intakeId}`, async () => {
  const record = await getJobIntakeRecord(intakeId);
  if (!record) throw new Error("Not found.");
  const current = record.dispatch;
  if (!current || current.status === "needs_contractor") {
    throw new Error("This job is not ready to dispatch.");
  }
  if (current.status === "sent") {
    return { record, gmailMessageId: undefined, alreadySent: true };
  }

  const draft: JobEmailDraft = {
    ...(record.emailDraft ?? buildDefaultEmailDraft(record)),
    ...(options?.to ? { to: options.to } : {}),
    ...(options?.cc ? { cc: options.cc } : {}),
    ...(options?.subject ? { subject: options.subject } : {}),
    ...(options?.body ? { body: options.body } : {}),
  };
  if (!approvalStillMatches(record, draft)) {
    throw new Error("Logan must approve this exact dispatch before it is sent.");
  }

  const to = (draft.to || current.contractorEmail || "").trim();
  if (!to) throw new Error("Draft is missing a recipient.");

  const files = record.files ?? [];
  let workOrderId = current.workOrderId || record.workOrderId || undefined;
  if (!workOrderId || workOrderId.startsWith("local-")) {
    const created = await insertAssignedWorkOrder({ ...record, files }, current);
    if (!created || created.startsWith("local-")) {
      throw new Error("Work order was not created, so the dispatch was not sent.");
    }
    workOrderId = created;
  }

  const outboundBody = redactSubcontractorDne(draft.body, record.parsed.dneAmount);
  let sentAt: string | undefined;
  let gmailMessageId: string | undefined;
  let errorMessage: string | undefined;
  let status: JobDispatch["status"] = "assigned";

  if (deliverableEmail(to)) {
    const sender = options?.sendEmail ?? sendAssignment;
    const result = await sender({
      to,
      cc: draft.cc,
      subject: draft.subject,
      body: outboundBody,
      files,
      pdfPath: current.documentPath,
    });
    gmailMessageId = result.id;
    sentAt = new Date().toISOString();
    status = "sent";
  } else if (to) {
    errorMessage = "Contractor email looks like a sample address, so the work order was assigned without sending.";
  } else {
    errorMessage = "This contractor has no email, so the branded work order was assigned without sending.";
  }

  const updated = await updateJobIntakeRecord(record.id, {
    status: "tracked",
    workOrderId,
    dispatch: {
      ...current,
      status,
      workOrderId,
      sentAt,
      error: errorMessage,
      updatedAt: new Date().toISOString(),
    },
    emailDraft: {
      ...draft,
      to,
      body: outboundBody,
      status: status === "sent" ? "sent" : "approved",
      updatedAt: new Date().toISOString(),
      sentAt,
    },
  });

  return { record: updated, gmailMessageId };
  });
}

export async function sendReviewedJobIntakeEmail(input: {
  id: string;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  sendEmail?: (input: OutboundEmail) => Promise<{ id: string }>;
}) {
  const record = await getJobIntakeRecord(input.id);
  if (!record) throw new Error("Not found.");
  const waiting =
    record.dispatch && (record.dispatch.status === "pending_review" || record.dispatch.status === "assigned");
  if (waiting) {
    return releaseReviewedDispatch(input.id, input);
  }

  const draft: JobEmailDraft = {
    ...(record.emailDraft ?? buildDefaultEmailDraft(record)),
    ...(input.to ? { to: input.to } : {}),
    ...(input.cc ? { cc: input.cc } : {}),
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.body ? { body: input.body } : {}),
  };
  if (!draft.to?.trim()) throw new Error("Draft is missing a recipient.");
  if (!approvalStillMatches(record, draft)) {
    throw new Error("Logan must approve this exact dispatch before it is sent.");
  }

  const contractorEmail = record.dispatch?.contractorEmail?.trim().toLowerCase();
  const body =
    contractorEmail && draft.to.trim().toLowerCase() === contractorEmail
      ? redactSubcontractorDne(draft.body, record.parsed.dneAmount)
      : draft.body;
  const { sendApprovedGmailDraft } = await import("./google.ts");
  const sent = await sendApprovedGmailDraft({
    to: draft.to,
    cc: draft.cc,
    subject: draft.subject,
    body,
  });
  const updated = await updateJobIntakeRecord(input.id, {
    emailDraft: {
      ...draft,
      body,
      status: "sent",
      updatedAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    },
  });
  return { record: updated, gmailMessageId: sent.id as string | undefined };
}

let cyclePromise: Promise<DispatchCycleResult> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export async function runDispatchCycle(options?: { sync?: boolean; force?: boolean }): Promise<DispatchCycleResult> {
  if (cyclePromise && !options?.force) return cyclePromise;
  cyclePromise = runCycle(options).finally(() => {
    cyclePromise = null;
  });
  return cyclePromise;
}

async function runCycle(options?: { sync?: boolean }): Promise<DispatchCycleResult> {
  const state = await loadDispatchMonitorState();
  let synced = false;
  let syncNote = "";
  if (options?.sync !== false) {
    try {
      const { syncAllJobSources } = await import("./source-sync.ts");
      const summary = await syncAllJobSources({ force: true });
      synced = true;
      syncNote = summary.message;
    } catch (error) {
      syncNote = error instanceof Error ? error.message : "Source sync failed.";
    }
  }

  const result = await dispatchIncomingWorkOrders();
  const next: DispatchCycleResult = {
    ...result,
    synced,
    message: [syncNote, result.message].filter(Boolean).join(" "),
  };
  await saveDispatchMonitorState({
    ...state,
    lastTickAt: next.ranAt,
    lastError: undefined,
    lastResult: next,
  });
  return next;
}

export function stopDispatchMonitor() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function ensureDispatchMonitor() {
  const state = await loadDispatchMonitorState();
  if (!state.enabled) {
    stopDispatchMonitor();
    return state;
  }
  if (!state.startedAt) {
    await saveDispatchMonitorState({ ...state, startedAt: new Date().toISOString() });
  }
  if (timer) return loadDispatchMonitorState();
  const delay = Math.max(MIN_INTERVAL_MS, state.intervalMs);
  timer = setInterval(() => {
    void runDispatchCycle({ sync: true }).catch(async (error) => {
      const current = await loadDispatchMonitorState();
      await saveDispatchMonitorState({
        ...current,
        lastError: error instanceof Error ? error.message : "Dispatch monitor failed.",
      });
    });
  }, delay);
  timer.unref?.();
  setTimeout(() => {
    void runDispatchCycle({ sync: true }).catch(() => null);
  }, 4000).unref?.();
  return loadDispatchMonitorState();
}

export async function setDispatchMonitorEnabled(enabled: boolean) {
  const state = await loadDispatchMonitorState();
  const next = await saveDispatchMonitorState({
    ...state,
    enabled,
    startedAt: enabled ? state.startedAt || new Date().toISOString() : state.startedAt,
  });
  if (enabled) await ensureDispatchMonitor();
  else stopDispatchMonitor();
  return next;
}

export async function updateDispatchMonitorSettings(patch: { autoSend?: boolean; intervalMs?: number }) {
  const state = await loadDispatchMonitorState();
  const next = await saveDispatchMonitorState({
    ...state,
    autoSend: false,
    intervalMs: patch.intervalMs ? Math.max(MIN_INTERVAL_MS, patch.intervalMs) : state.intervalMs,
  });
  if (next.enabled) {
    stopDispatchMonitor();
    await ensureDispatchMonitor();
  }
  return next;
}
