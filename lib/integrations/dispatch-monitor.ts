import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isDemoMode } from "../env.ts";
import { brandedWorkOrderSubject, buildBrandedWorkOrderText, validateContractorCopy, writeBrandedWorkOrderPdf } from "./branded-work-order.ts";
import {
  matchContractor,
  toContractorCandidate,
  type ContractorCandidate,
  type DispatchRoute,
  type JobLocation,
} from "./contractor-match.ts";

export type { ContractorCandidate, DispatchRoute } from "./contractor-match.ts";
import { isImageFile, type IntakeFile } from "./intake-files.ts";
import {
  buildDefaultEmailDraft,
  getJobIntakeRecord,
  loadJobIntakeStore,
  updateJobIntakeRecord,
  intakeToWorkOrderDraft,
  type ContractorCopy,
  type JobDispatch,
  type JobEmailDraft,
  type JobIntakeRecord,
} from "./job-intake.ts";
import { approvalStillMatches, stampLoganApproval } from "./dispatch-approval.ts";
import { withFileLock } from "../file-lock.ts";
import { formatMoney } from "./subcontractor-dne.ts";

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

export function shouldDispatch(record: JobIntakeRecord) {
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
    status: "New",
    source: draft.source === "Email" ? "Email" : "Other",
    // This is an internal tracker row. Do not grant crew access to its raw
    // customer record via subcontractor assignment. Crew copy is sent separately.
    subcontractor_id: null,
    work_order_number: dispatch.fortifiedWorkOrderNumber,
    internal_notes: [
      draft.internal_notes,
      `Fortified WO ${dispatch.fortifiedWorkOrderNumber}`,
      dispatch.contractorName ? `Assigned to ${dispatch.contractorName}` : null,
      record.parsed.dneAmount != null
        ? `Customer DNE ${formatMoney(record.parsed.dneAmount)}. Subcontractor NTE ${formatMoney(dispatch.contractorCopy?.subcontractorDne)}.`
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
  return withFileLock("dispatch-queue", async () => {
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
      if (!shouldDispatch(record) || record.dispatchHold || record.status === "dismissed") {
        skipped += 1;
        continue;
      }
      const current = record.dispatch;
      if (current && ["sent", "pending_review", "withdrawn", "send_uncertain"].includes(current.status)) {
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

      const existingNumber = current?.fortifiedWorkOrderNumber;
      const match = matchContractor(jobLocation(record), routes, contractors, { routeOnly: true });
      if (!match) {
        const where = [record.parsed.city, record.parsed.state].filter(Boolean).join(", ") || "an unknown location";
        const dispatch: JobDispatch = {
          status: "needs_contractor",
          fortifiedWorkOrderNumber: existingNumber,
          reason: `No predetermined contractor covers ${where}. Add a matching dispatch route for an active subcontractor; conflicting routes must be resolved.`,
          updatedAt: new Date().toISOString(),
        };
        await updateJobIntakeRecord(record.id, { dispatch });
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
        updatedAt: new Date().toISOString(),
      };
      pendingReview += 1;

      await updateJobIntakeRecord(record.id, {
        dispatch,
        emailDraft: {
          to: match.contractor.email || "",
          subject: `Fortified WO ${fortifiedWorkOrderNumber}`,
          body: "",
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
  });
}

function previewContractorDraft(record: JobIntakeRecord, copy: ContractorCopy) {
  const dispatch = record.dispatch;
  if (!dispatch?.routeId || !dispatch.fortifiedWorkOrderNumber || !dispatch.contractorName || !deliverableEmail(dispatch.contractorEmail)) {
    throw new Error("Choose a predetermined route with an active contractor and a valid email address.");
  }
  const assignment = {
    fortifiedWorkOrderNumber: dispatch.fortifiedWorkOrderNumber,
    contractorName: dispatch.contractorName,
    contractorEmail: dispatch.contractorEmail,
    reason: "",
  };
  const draft: JobEmailDraft = {
    to: dispatch.contractorEmail!,
    subject: brandedWorkOrderSubject(assignment),
    body: buildBrandedWorkOrderText(record, assignment, copy),
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
  return { assignment, draft };
}

export async function saveContractorDispatchDraft(
  id: string,
  value: Partial<ContractorCopy>,
  verifiedCustomerDne?: number
) {
  return withFileLock(`dispatch-${id}`, async () => {
    const record = await getJobIntakeRecord(id);
    if (!record) throw new Error("Not found.");
    if (record.dispatch?.status !== "pending_review" && record.dispatch?.status !== "assigned") {
      throw new Error("This job must be held for review with a predetermined contractor.");
    }
    if (verifiedCustomerDne !== undefined && (typeof verifiedCustomerDne !== "number" ||
      !Number.isFinite(verifiedCustomerDne) || verifiedCustomerDne <= 0 ||
      !Number.isSafeInteger(Math.round(verifiedCustomerDne * 100)) ||
      Math.abs(Math.round(verifiedCustomerDne * 100) / 100 - verifiedCustomerDne) > 0.000001)) {
      throw new Error("Enter a valid verified customer DNE in dollars and cents.");
    }
    const reviewed = verifiedCustomerDne === undefined ? record : {
      ...record, parsed: { ...record.parsed, dneAmount: verifiedCustomerDne },
    };
    const copy = validateContractorCopy(reviewed, value);
    const { draft } = previewContractorDraft(reviewed, copy);
    return updateJobIntakeRecord(id, {
      parsed: verifiedCustomerDne === undefined ? undefined : reviewed.parsed,
      dispatch: { ...record.dispatch, contractorCopy: copy, documentPath: undefined, updatedAt: draft.updatedAt },
      emailDraft: draft,
    }, { expectedUpdatedAt: record.updatedAt, failOnDispatchHold: true });
  });
}

function matchReviewedFields(record: JobIntakeRecord, generated: JobEmailDraft, saved?: JobEmailDraft | null) {
  if (!saved || saved.cc || saved.to !== generated.to || saved.subject !== generated.subject || saved.body !== generated.body) {
    throw new Error("Prepare and approve the current crew-facing draft. Free-form or outdated drafts are not dispatchable.");
  }
  if (record.dispatch?.status !== "pending_review" && record.dispatch?.status !== "assigned") {
    throw new Error("This job is not ready to dispatch.");
  }
  return saved;
}

export async function approveContractorDispatch(id: string, reviewedAt: string | undefined) {
  return withFileLock(`dispatch-${id}`, async () => {
    const record = await getJobIntakeRecord(id);
    if (!record) throw new Error("Not found.");
    const copy = validateContractorCopy(record, record.dispatch?.contractorCopy);
    if (!copy.customerCleared) throw new Error("Verify and confirm that the customer permits this subcontractor.");
    const { draft } = previewContractorDraft(record, copy);
    const saved = matchReviewedFields(record, draft, record.emailDraft);
    if (saved.updatedAt !== reviewedAt) throw new Error("The draft changed. Review the current draft before approving.");
    return updateJobIntakeRecord(id, { emailDraft: stampLoganApproval(record, saved) },
      { expectedUpdatedAt: record.updatedAt, failOnDispatchHold: true });
  });
}

export async function releaseReviewedDispatch(
  intakeId: string,
  options?: { sendEmail?: (input: OutboundEmail) => Promise<{ id: string }> }
) {
  return withFileLock(`dispatch-${intakeId}`, async () => {
    const record = await getJobIntakeRecord(intakeId);
    if (!record) throw new Error("Not found.");
    const current = record.dispatch;
    if (current?.status === "sent") return { record, gmailMessageId: undefined, alreadySent: true };
    if (!current || (current.status !== "pending_review" && current.status !== "assigned")) {
      throw new Error("This job is not ready to dispatch. Do not retry an uncertain send.");
    }
    const copy = validateContractorCopy(record, current.contractorCopy);
    if (!copy.customerCleared) throw new Error("Verify and confirm that the customer permits this subcontractor.");
    const { assignment, draft } = previewContractorDraft(record, copy);
    const saved = matchReviewedFields(record, draft, record.emailDraft);
    if (!approvalStillMatches(record, saved)) throw new Error("Logan must approve this exact dispatch before it is sent.");

    // Provider delivery is deliberately disabled in demo/local mode; only the
    // authenticated owner route can request it in a configured installation.
    if (!options?.sendEmail) {
      if (isDemoMode()) throw new Error("Demo mode does not send dispatch email.");
      const routes = await loadDispatchRoutes();
      const contractors = await loadContractors();
      const match = matchContractor(jobLocation(record), routes, contractors, { routeOnly: true });
      if (!match || match.routeId !== current.routeId || match.contractor.id !== current.contractorId || match.contractor.email !== draft.to) {
        throw new Error("The live routing rule or contractor changed. Hold this job for review.");
      }
    }

    // Regenerate from the exact reviewed projection. No provider URLs, source
    // filenames, raw scope or intake attachments are passed to the mail sender.
    const written = await writeBrandedWorkOrderPdf({ directory: documentsDir(), record, assignment, copy });
    const workOrderId = current.workOrderId || record.workOrderId || await insertAssignedWorkOrder(record, current);
    if (!workOrderId || workOrderId.startsWith("local-")) {
      throw new Error("Work order was not created, so the dispatch was not sent.");
    }

    const pending = await updateJobIntakeRecord(intakeId, {
      workOrderId,
      dispatch: { ...current, status: "send_uncertain", workOrderId, updatedAt: new Date().toISOString() },
    }, { expectedUpdatedAt: record.updatedAt, failOnDispatchHold: true });
    const sender = options?.sendEmail ?? sendAssignment;
    const result = await sender({ to: draft.to, subject: draft.subject, body: draft.body, files: [], pdfPath: written.pdfPath });
    const sentAt = new Date().toISOString();
    const latest = await getJobIntakeRecord(intakeId);
    const updated = await updateJobIntakeRecord(intakeId, {
      status: "tracked",
      workOrderId,
      dispatch: { ...pending.dispatch!, status: latest?.dispatchHold ? "withdrawn" : "sent", documentPath: written.pdfPath, sentAt, updatedAt: sentAt },
      emailDraft: { ...saved, status: "sent", updatedAt: sentAt, sentAt },
    });
    return { record: updated, gmailMessageId: result.id };
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
  if (record.dispatch || shouldDispatch(record) || record.dispatchHold) {
    if (input.to !== undefined || input.cc !== undefined || input.subject !== undefined || input.body !== undefined) {
      throw new Error("The reviewed contractor copy cannot be overridden at send time.");
    }
    return releaseReviewedDispatch(input.id, input);
  }
  if (isDemoMode()) throw new Error("Demo mode does not send email.");
  return withFileLock(`email-${input.id}`, async () => {
    const fresh = await getJobIntakeRecord(input.id);
    if (!fresh) throw new Error("Not found.");
    if (fresh.dispatch || shouldDispatch(fresh) || fresh.dispatchHold) throw new Error("Use the reviewed contractor dispatch.");
    if (fresh.emailDraft?.status === "sent") return { record: fresh, gmailMessageId: undefined };
    const draft: JobEmailDraft = {
      ...(fresh.emailDraft ?? buildDefaultEmailDraft(fresh)),
      ...(input.to ? { to: input.to } : {}),
      ...(input.cc ? { cc: input.cc } : {}),
      ...(input.subject ? { subject: input.subject } : {}),
      ...(input.body ? { body: input.body } : {}),
    };
    if (!draft.to?.trim()) throw new Error("Draft is missing a recipient.");
    if (!approvalStillMatches(fresh, draft)) throw new Error("Logan must approve this exact email before it is sent.");
    const { sendApprovedGmailDraft } = await import("./google.ts");
    const sent = await sendApprovedGmailDraft({ to: draft.to, cc: draft.cc, subject: draft.subject, body: draft.body });
    const sentAt = new Date().toISOString();
    const updated = await updateJobIntakeRecord(input.id, { emailDraft: { ...draft, status: "sent", updatedAt: sentAt, sentAt } });
    return { record: updated, gmailMessageId: sent.id as string | undefined };
  });
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
