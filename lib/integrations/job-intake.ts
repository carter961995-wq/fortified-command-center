import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  classifyEmail,
  detectDispatchSource,
  projectKey,
  type EmailCategory,
} from "./email-classify.ts";
import { withFileLock } from "../file-lock.ts";
import { isDemoMode } from "../env.ts";
import { collectFilesFromText, mergeIntakeFiles, type IntakeFile } from "./intake-files.ts";
import { isPlaceholderIntakeRecord } from "./placeholder-data.ts";

export type JobIntakeSource = "gmail" | "mhelpdesk" | "truesource" | "manual";

export type JobIntakeStatus = "new" | "reviewed" | "tracked" | "dismissed";

export type JobPipelineCategory = EmailCategory;

export type ParsedJobFields = {
  customerName?: string;
  storeNumber?: string;
  locationName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  workOrderNumber?: string;
  portalJobId?: string;
  purchaseOrderNumber?: string;
  description?: string;
  jobDetails?: string;
  /** Do Not Exceed / Not To Exceed amount */
  dneAmount?: number | null;
  timeframe?: string;
  dueDate?: string | null;
  requestedDate?: string | null;
  priority?: string;
  tradeType?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
};

export type ContractorCopy = {
  subcontractorDne: number;
  scope: string;
  site?: string;
  schedule?: string;
  customerCleared: boolean;
};

export type JobEmailDraft = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  status: "draft" | "approved" | "sent";
  updatedAt: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvalFingerprint?: string;
  sentAt?: string;
};

export type JobDispatch = {
  status: "pending_review" | "assigned" | "sent" | "needs_contractor" | "withdrawn" | "send_uncertain";
  contractorId?: string;
  contractorName?: string;
  contractorEmail?: string;
  contractorPhone?: string;
  reason?: string;
  routeId?: string;
  fortifiedWorkOrderNumber?: string;
  workOrderId?: string;
  documentPath?: string;
  contractorCopy?: ContractorCopy;
  sentAt?: string;
  error?: string;
  updatedAt: string;
};

export type MhelpdeskFieldMap = {
  workOrderNumber?: string;
  storeNumber?: string;
  location?: string;
  address?: string;
  description?: string;
  jobDetails?: string;
  dneAmount?: number | null;
  scheduledDate?: string | null;
  notes?: string;
  timeframe?: string;
};

export type JobIntakeRecord = {
  id: string;
  status: JobIntakeStatus;
  source: JobIntakeSource;
  sourceRef: string;
  sourceRefs?: string[];
  identityKey?: string;
  latestSourceAt?: string;
  dispatchHold?: string;
  receivedAt: string;
  subject?: string;
  from?: string;
  snippet?: string;
  rawText: string;
  parsed: ParsedJobFields;
  category: JobPipelineCategory;
  notes: string;
  scheduledDate?: string | null;
  photoUrls: string[];
  files?: IntakeFile[];
  dispatch?: JobDispatch | null;
  workOrderId?: string | null;
  emailDraft?: JobEmailDraft | null;
  mhelpdeskPush?: {
    status: "ready" | "pushed" | "failed" | "needs_connection";
    fieldMap: MhelpdeskFieldMap;
    error?: string;
    updatedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type JobIntakeStore = {
  updatedAt: string;
  records: JobIntakeRecord[];
};

const JOB_EMAIL_HINTS =
  /\b(work\s*order|wo[#:\s-]|job\s*assigned|new\s*job|service\s*request|dispatch|store\s*#|dne|n\.?t\.?e\.?|not\s*to\s*exceed|mhelp|mhelpdesk|truesource|affiliate connect|ticket\s*#|invitation to bid|\bitb\b|\brfp\b|\brfq\b|request for (?:quote|proposal|bid)|quote approved|approved quote|quoted|bid request|please bid)\b/i;

function integrationDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

function intakePath() {
  return path.join(integrationDir(), "job-intake.json");
}

async function ensureDir() {
  await mkdir(integrationDir(), { recursive: true });
}

async function mhelpdeskPushStatus(): Promise<"ready" | "needs_connection"> {
  const { loadMhelpdeskConnection } = await import("./mhelpdesk.ts");
  return (await loadMhelpdeskConnection()) ? "ready" : "needs_connection";
}

export async function loadJobIntakeStore(): Promise<JobIntakeStore> {
  try {
    const raw = await readFile(intakePath(), "utf8");
    const parsed = JSON.parse(raw) as JobIntakeStore;
    return {
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch {
    return { updatedAt: new Date().toISOString(), records: [] };
  }
}

export async function saveJobIntakeStore(store: JobIntakeStore) {
  await ensureDir();
  const next = { ...store, updatedAt: new Date().toISOString() };
  const target = intakePath();
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return next;
}

export function looksLikeJobAssignmentEmail(input: {
  subject?: string;
  from?: string;
  snippet?: string;
  body?: string;
}) {
  const haystack = [input.subject, input.from, input.snippet, input.body].filter(Boolean).join("\n");
  return JOB_EMAIL_HINTS.test(haystack);
}

export function intakeCategory(record: Pick<JobIntakeRecord, "subject" | "from" | "snippet" | "rawText" | "category">): JobPipelineCategory {
  return (
    record.category ||
    classifyEmail({
      subject: record.subject,
      from: record.from,
      snippet: record.snippet,
      body: record.rawText,
    })
  );
}

export function intakeProjectLabel(record: JobIntakeRecord) {
  return projectKey(record.parsed);
}

export function searchJobIntakeRecords(
  records: JobIntakeRecord[],
  query: string,
  filters?: { source?: JobIntakeSource | "all"; category?: JobPipelineCategory | "all" }
) {
  const needle = query.trim().toLowerCase();
  return records.filter((record) => {
    if (filters?.source && filters.source !== "all" && record.source !== filters.source) return false;
    if (filters?.category && filters.category !== "all" && intakeCategory(record) !== filters.category) return false;
    if (!needle) return true;
    const haystack = [
      record.subject,
      record.from,
      record.snippet,
      record.rawText,
      record.source,
      intakeCategory(record),
      intakeProjectLabel(record),
      ...Object.values(record.parsed).map((value) => (value == null ? "" : String(value))),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function groupJobIntakeByProject(records: JobIntakeRecord[]) {
  const groups = new Map<string, JobIntakeRecord[]>();
  for (const record of records) {
    const key = intakeProjectLabel(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([project, jobs]) => ({ project, jobs }));
}

export function buildCleanJobDocument(record: JobIntakeRecord) {
  const p = record.parsed;
  const lines = [
    "JOB BRIEF",
    "=========",
    "",
    `Source: ${record.source}${record.from ? ` · ${record.from}` : ""}`,
    `Received: ${record.receivedAt}`,
    record.subject ? `Subject: ${record.subject}` : null,
    "",
    "IDENTIFIERS",
    "-----------",
    `Work Order #: ${p.workOrderNumber || "—"}`,
    `PO #: ${p.purchaseOrderNumber || "—"}`,
    `Store #: ${p.storeNumber || "—"}`,
    `Customer: ${p.customerName || "—"}`,
    "",
    "LOCATION",
    "--------",
    `Site: ${p.locationName || "—"}`,
    `Address: ${[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ") || "—"}`,
    "",
    "SCOPE",
    "-----",
    `Description: ${p.description || "—"}`,
    `Details: ${p.jobDetails || "—"}`,
    `Trade: ${p.tradeType || "—"}`,
    `Priority: ${p.priority || "—"}`,
    "",
    "COMMERCIAL LIMITS",
    "-----------------",
    `DNE / NTE: ${p.dneAmount != null ? `$${Number(p.dneAmount).toFixed(2)}` : "—"}`,
    `Timeframe: ${p.timeframe || "—"}`,
    `Requested: ${p.requestedDate || "—"}`,
    `Due: ${p.dueDate || "—"}`,
    `Scheduled: ${record.scheduledDate || "—"}`,
    "",
    "CONTACTS",
    "--------",
    `Name: ${p.contactName || "—"}`,
    `Phone: ${p.contactPhone || "—"}`,
    `Email: ${p.contactEmail || "—"}`,
    "",
    "NOTES",
    "-----",
    record.notes || "—",
  ];
  return lines.filter((line) => line !== null).join("\n");
}

export function buildDefaultEmailDraft(record: JobIntakeRecord): JobEmailDraft {
  if (record.category === "work_order" || record.category === "approved_quote" || record.dispatch) {
    return {
      to: "", subject: "Fortified work order", body: "", status: "draft", updatedAt: new Date().toISOString(),
    };
  }
  const p = record.parsed;
  const to = p.contactEmail || "";
  const subject = [
    p.workOrderNumber ? `WO ${p.workOrderNumber}` : null,
    p.storeNumber ? `Store ${p.storeNumber}` : null,
    p.description || record.subject || "Job update",
  ]
    .filter(Boolean)
    .join(" · ");

  const body = [
    "Hello,",
    "",
    "Please find the latest update for this work order:",
    "",
    buildCleanJobDocument(record),
    "",
    "Thank you,",
    "Fortified Fence & Weld",
  ].join("\n");

  return {
    to,
    subject,
    body,
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

export function buildMhelpdeskFieldMap(record: JobIntakeRecord): MhelpdeskFieldMap {
  const p = record.parsed;
  return {
    workOrderNumber: p.workOrderNumber,
    storeNumber: p.storeNumber,
    location: p.locationName || [p.city, p.state].filter(Boolean).join(", "),
    address: [p.address, p.city, p.state, p.zip].filter(Boolean).join(", "),
    description: p.description,
    jobDetails: p.jobDetails,
    dneAmount: p.dneAmount ?? null,
    scheduledDate: record.scheduledDate ?? p.dueDate ?? null,
    notes: record.notes,
    timeframe: p.timeframe,
  };
}

const NEXT_INTAKE_LABEL =
  "(?:\\n\\s*(?:PO|P\\.O\\.|Purchase\\s*Order|Work\\s*Order|WO|W\\.O\\.|Scope(?:\\s*of\\s*Work)?|Description|Issue|Problem|Details|Instructions|Notes|DNE|NTE|Not\\s*to\\s*Exceed|Timeframe|Window|Due|Requested|Store|Customer|Client|Account|Location|Site|Facility|Address|City|State|Zip|Postal|Priority|Trade|Contact|Phone|Email)\\b)";

function labeledBlock(text: string, labels: string[]) {
  const names = labels.map((label) => label.replace(/\s+/g, "\\s*")).join("|");
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${names})\\s*[:#-]\\s*([\\s\\S]*?)(?=${NEXT_INTAKE_LABEL}|$)`, "i"));
  const value = match?.[1]?.replace(/\s+$/g, "").trim();
  return value || undefined;
}

// Quotes, markup and scripts are not interpreted as job instructions. This
// extracts only simple fields and leaves incomplete notices in review.
function normalizeAssignmentBody(body: string) {
  if (!/<(?:html|body|table|tr|td|div|p|span|br|strong|b)(?:\s|>|\/)/i.test(body)) return body;
  return body
    .replace(/<(style|script|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/td>[ \t]*<td\b[^>]*>/gi, " ")
    .replace(/<\/?(?:tr|div|p|h[1-6]|br)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&(?:amp|#38);/gi, "&")
    .replace(/&(?:num|#35);/gi, "#")
    .replace(/&(?:dollar|#36);/gi, "$")
    .replace(/[ \t]+/g, " ")
    .replace(/\n +/g, "\n");
}

function heuristicParse(rawText: string, subject?: string): ParsedJobFields {
  rawText = normalizeAssignmentBody(rawText);
  // Prefer body over subject so short subjects like "WO assigned" do not steal identifiers.
  const text = `${rawText}\n${subject ?? ""}`;
  const pick = (re: RegExp) => text.match(re)?.[1]?.trim();
  const label = "[\\s:#!-]*";

  const dneRaw = pick(new RegExp(`\\b(?:DNE|NTE|Not\\s*to\\s*Exceed)${label}\\$?\\s*([0-9,.]+)`, "i"));
  const dneAmount = dneRaw ? Number(dneRaw.replace(/,/g, "")) : null;
  const scope = labeledBlock(rawText, ["Scope of work", "Scope of Work", "Scope"]);
  const description = labeledBlock(rawText, ["Description", "Issue", "Problem"]);
  const details = labeledBlock(rawText, ["Details", "Instructions", "Notes"]);
  const jobDetails = [scope, details].filter(Boolean).join("\n\n") || undefined;

  return {
    portalJobId: pick(/\bJob(?:\s+ID)?\s*#?\s*:\s*([0-9]+)\b/i) || pick(/\bJob\s*#\s*([0-9]+)\b/i),
    workOrderNumber:
      pick(new RegExp(`\\bWork\\s*Order(?:\\s*(?:#|No\\.?|Number))?${label}(?=[A-Z0-9-]*[0-9])([A-Z0-9][A-Z0-9-]*)\\b`, "i")) ||
      pick(new RegExp(`\\b(?:WO|W\\.O\\.)(?:\\s*(?:#|No\\.?|Number))?${label}(?=[A-Z0-9-]*[0-9])([A-Z0-9][A-Z0-9-]*)\\b`, "i")),
    purchaseOrderNumber:
      pick(new RegExp(`\\bPurchase\\s*Order(?:\\s*(?:#|No\\.?|Number))?${label}([A-Z0-9][A-Z0-9-]{1,})`, "i")) ||
      pick(new RegExp(`\\bP\\.?O\\.?(?:\\s*(?:#|No\\.?|Number))?${label}([A-Z0-9][A-Z0-9-]{1,})`, "i")),
    storeNumber: pick(new RegExp(`\\bStore${label}([A-Z0-9-]{1,})`, "i")),
    customerName: pick(new RegExp(`\\b(?:Customer|Client|Account)${label}([^\\n]+)`, "i")),
    locationName: pick(new RegExp(`\\b(?:Location|Site|Facility)${label}([^\\n]+)`, "i")),
    address: pick(new RegExp(`\\b(?:Address|Job\\s*Site)${label}([^\\n]+)`, "i")),
    city: pick(new RegExp(`\\bCity${label}([^\\n]+)`, "i")),
    state: pick(new RegExp(`\\bState${label}([A-Z]{2})\\b`, "i")),
    zip: pick(new RegExp(`\\b(?:Zip|Postal)${label}(\\d{5}(?:-\\d{4})?)`, "i")),
    description: description || (jobDetails ? undefined : subject),
    jobDetails,
    dneAmount: Number.isFinite(dneAmount as number) ? dneAmount : null,
    timeframe: pick(new RegExp(`\\b(?:Timeframe|Window|Service\\s*Window|Complete\\s*by)${label}([^\\n]+)`, "i")),
    dueDate: pick(
      new RegExp(
        `\\b(?:Due|Due\\s*Date)${label}([0-9]{1,2}[\\/-][0-9]{1,2}[\\/-][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})`,
        "i"
      )
    ),
    requestedDate: pick(
      new RegExp(
        `\\b(?:Requested|Request\\s*Date)${label}([0-9]{1,2}[\\/-][0-9]{1,2}[\\/-][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})`,
        "i"
      )
    ),
    priority: pick(new RegExp(`\\bPriority${label}(Low|Medium|High|Urgent)`, "i")),
    tradeType: pick(new RegExp(`\\b(?:Trade|Service\\s*Type|Category)${label}([^\\n]+)`, "i")),
    contactName: pick(new RegExp(`\\b(?:Contact|On[- ]?site\\s*Contact)${label}([^\\n]+)`, "i")),
    contactPhone: pick(new RegExp(`\\b(?:Phone|Mobile|Tel)${label}([+()0-9.-\\s]{7,})`, "i")),
    contactEmail: pick(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i),
  };
}

export async function parseJobAssignmentText(input: {
  subject?: string;
  from?: string;
  body: string;
}): Promise<ParsedJobFields> {
  const fallback = heuristicParse(input.body, input.subject);
  if (!process.env.GEMINI_API_KEY) return fallback;

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const prompt = `Extract a commercial field-service job assignment into JSON with these keys:
customerName, storeNumber, locationName, address, city, state, zip,
workOrderNumber, purchaseOrderNumber, description, jobDetails, dneAmount,
timeframe, dueDate, requestedDate, priority, tradeType, contactName, contactPhone, contactEmail.
Use null for unknown values. dneAmount must be a number or null (Do Not Exceed / NTE).
Source email:
Subject: ${input.subject ?? ""}
From: ${input.from ?? ""}
Body:
${input.body.slice(0, 12000)}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) return fallback;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallback;
    const parsed = JSON.parse(text) as ParsedJobFields;
    return {
      ...fallback,
      ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== null && value !== undefined && value !== "")),
    };
  } catch {
    return fallback;
  }
}

function normalized(value?: string) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") || "";
}

function sourceIdentity(provider: JobIntakeSource, parsed: ParsedJobFields) {
  const customer = normalized(parsed.customerName?.replace(/:\s*\d+.*$/, ""));
  const order = parsed.workOrderNumber?.trim().toUpperCase();
  return customer && order ? `${provider}:${customer}:${order}` : undefined;
}

function intakeIdentity(provider: JobIntakeSource, origin: JobIntakeSource, parsed: ParsedJobFields, from?: string) {
  const base = sourceIdentity(provider, parsed);
  const sender = from?.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase();
  return base && sender && origin !== "manual" ? `${origin}:${sender}:${base}` : undefined;
}

export function isDispatchWithdrawal(subject?: string) {
  return /^(?:(?:re|fwd):\s*)*(?:correction\s*[-–—:]\s*)?(?:disregard|withdraw|cancel)\s+(?:the\s+)?(?:fortified\s+)?(?:dispatch|work order|wo)\b/i.test(subject?.trim() || "");
}

export async function upsertJobIntakeFromSource(input: {
  source: JobIntakeSource;
  sourceRef: string;
  receivedAt?: string;
  subject?: string;
  from?: string;
  snippet?: string;
  rawText: string;
  parsed?: ParsedJobFields;
  files?: IntakeFile[];
  trustedDispatchCorrection?: boolean;
}): Promise<{ record: JobIntakeRecord; created: boolean }> {
  const detectedSource =
    input.source === "gmail"
      ? detectDispatchSource({
          subject: input.subject,
          from: input.from,
          snippet: input.snippet,
          body: input.rawText,
        })
      : input.source;
  const now = new Date().toISOString();
  const parsed = input.parsed ?? heuristicParse(input.rawText, input.subject);
  const category = classifyEmail({
    subject: input.subject,
    from: input.from,
    snippet: input.snippet,
    body: input.rawText,
  });

  const sender = input.from?.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase();
  const directPortal = input.source === "mhelpdesk" || input.source === "truesource";
  const portalScope = directPortal ? `${sender || "unidentified"}:${normalized(parsed.customerName)}` : "";
  const sourceKey = `${input.source}:${portalScope}:${input.sourceRef}`;
  const identity = intakeIdentity(detectedSource, input.source, parsed, input.from);
  const withdrawal = isDispatchWithdrawal(input.subject);
  return withFileLock("job-intake-write", async () => {
    const store = await loadJobIntakeStore();
    const exact = store.records.find((row) =>
      row.sourceRefs?.includes(sourceKey) ||
      (!row.sourceRefs && (row.source === detectedSource || row.source === input.source) && row.sourceRef === input.sourceRef &&
        (input.source === "gmail" || input.source === "manual" ||
          (row.from?.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase() === sender &&
            normalized(row.parsed.customerName) === normalized(parsed.customerName)))));
    const inferredOrigin = (row: JobIntakeRecord) => row.sourceRefs?.[0]?.startsWith("gmail:") ? "gmail" : row.source;
    const matches = identity ? store.records.filter((row) =>
      (row.identityKey || intakeIdentity(row.source, inferredOrigin(row), row.parsed, row.from)) === identity) : [];
    const possibleAliasKey = sourceIdentity(detectedSource, parsed);
    const aliases = possibleAliasKey && detectedSource !== "gmail"
      ? store.records.filter((row) => inferredOrigin(row) !== input.source &&
        sourceIdentity(row.source, row.parsed) === possibleAliasKey)
      : [];
    const aliasHold = "A portal and email may refer to the same work order. Verify the account mapping before dispatch.";
    const trustedCorrection = input.source === "gmail" && input.trustedDispatchCorrection && withdrawal && parsed.workOrderNumber;
    const correctionMatches = trustedCorrection ? store.records.filter((row) =>
      row.parsed.workOrderNumber?.trim().toUpperCase() === parsed.workOrderNumber?.trim().toUpperCase()) : [];
    if (correctionMatches.length) {
      const correctionHold = correctionMatches.length === 1
        ? "This crew dispatch was withdrawn. The underlying job has not been canceled."
        : "A crew withdrawal matched multiple jobs. Verify which dispatch was withdrawn.";
      let first: JobIntakeRecord | undefined;
      store.records = store.records.map((row) => {
        if (!correctionMatches.some((match) => match.id === row.id)) return row;
        const updated: JobIntakeRecord = {
          ...row, updatedAt: now, dispatchHold: correctionHold,
          sourceRefs: [...new Set([...(row.sourceRefs ?? [`${row.source}:${row.sourceRef}`]), sourceKey])],
          dispatch: correctionMatches.length === 1 && row.dispatch
            ? { ...row.dispatch, status: "withdrawn", updatedAt: now } : row.dispatch,
        };
        first ??= updated;
        return updated;
      });
      await saveJobIntakeStore(store);
      return { record: first!, created: false };
    }
    const existing = exact ?? (matches.length === 1 ? matches[0] : undefined);
    if (aliases.length) {
      store.records = store.records.map((row) => aliases.some((alias) => alias.id === row.id)
        ? { ...row, dispatchHold: row.dispatchHold || aliasHold, updatedAt: now } : row);
    }
    const files = mergeIntakeFiles(existing?.files, [...(input.files ?? []), ...collectFilesFromText(input.rawText)]);

    if (existing) {
      const replay = Boolean((existing.sourceRefs?.includes(sourceKey) && !input.receivedAt) ||
        (input.receivedAt && input.receivedAt < (existing.latestSourceAt ?? existing.receivedAt)));
      const limitConflict = !replay && parsed.dneAmount != null && existing.parsed.dneAmount != null &&
        parsed.dneAmount !== existing.parsed.dneAmount;
      const idConflict = Boolean((parsed.workOrderNumber && existing.parsed.workOrderNumber &&
        normalized(parsed.workOrderNumber) !== normalized(existing.parsed.workOrderNumber)) ||
        (parsed.portalJobId && existing.parsed.portalJobId && parsed.portalJobId !== existing.parsed.portalJobId));
      const updated: JobIntakeRecord = {
        ...existing,
        sourceRefs: [...new Set([...(existing.sourceRefs ?? [`${existing.source}:${existing.sourceRef}`]), sourceKey])],
        identityKey: existing.identityKey || identity,
        latestSourceAt: replay ? existing.latestSourceAt : input.receivedAt ?? now,
        dispatchHold: existing.dispatchHold || (withdrawal ? "This dispatch was withdrawn. Verify the next assignment before sending." :
          idConflict || limitConflict ? "Incoming work-order identifiers or customer limits conflict. Hold before dispatch." :
          aliases.length ? aliasHold : undefined),
        dispatch: withdrawal && existing.dispatch ? { ...existing.dispatch, status: "withdrawn", updatedAt: now } : existing.dispatch,
        subject: replay ? existing.subject : input.subject ?? existing.subject,
        from: replay ? existing.from : input.from ?? existing.from,
        snippet: replay ? existing.snippet : input.snippet ?? existing.snippet,
        rawText: replay ? existing.rawText : input.rawText || existing.rawText,
        parsed: replay || idConflict || limitConflict ? existing.parsed : {
          ...existing.parsed,
          ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => value != null && value !== "")),
        },
        category: replay || category === "other" || existing.category === "work_order" || existing.category === "approved_quote"
          ? existing.category || category : category,
        files,
        photoUrls: files.map((file) => file.localPath || file.sourceUrl || file.name).filter(Boolean),
        updatedAt: now,
      };
      store.records = store.records.map((record) => (record.id === existing.id ? updated : record));
      await saveJobIntakeStore(store);
      return { record: updated, created: false };
    }

    const record: JobIntakeRecord = {
      id: randomUUID(),
      status: "new",
      source: detectedSource,
      sourceRef: input.sourceRef,
      sourceRefs: [sourceKey],
      identityKey: identity,
      latestSourceAt: input.receivedAt ?? now,
      dispatchHold: withdrawal ? "This dispatch was withdrawn. Verify the next assignment before sending." :
        matches.length > 1 ? "Multiple existing work orders share this customer and number. Review before dispatch." : aliases.length ? aliasHold : undefined,
      receivedAt: input.receivedAt ?? now,
      subject: input.subject,
      from: input.from,
      snippet: input.snippet,
      rawText: input.rawText,
      parsed,
      category,
      notes: "",
      scheduledDate: parsed.dueDate ?? null,
      photoUrls: files.map((file) => file.localPath || file.sourceUrl || file.name).filter(Boolean),
      files,
      workOrderId: null,
      emailDraft: null,
      mhelpdeskPush: {
        status: await mhelpdeskPushStatus(),
        fieldMap: buildMhelpdeskFieldMap({
          id: "tmp",
          status: "new",
          source: input.source,
          sourceRef: input.sourceRef,
          receivedAt: input.receivedAt ?? now,
          rawText: input.rawText,
          parsed,
          category,
          notes: "",
          photoUrls: [],
          createdAt: now,
          updatedAt: now,
        }),
        updatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
    record.emailDraft = buildDefaultEmailDraft(record);
    record.mhelpdeskPush = {
      status: await mhelpdeskPushStatus(),
      fieldMap: buildMhelpdeskFieldMap(record),
      updatedAt: now,
    };

    store.records.unshift(record);
    await saveJobIntakeStore(store);
    return { record, created: true };
  });
}

export async function getJobIntakeRecord(id: string) {
  const store = await loadJobIntakeStore();
  return store.records.find((record) => record.id === id) ?? null;
}

export async function updateJobIntakeRecord(
  id: string,
  patch: Partial<
    Pick<
      JobIntakeRecord,
      "status" | "notes" | "scheduledDate" | "photoUrls" | "files" | "dispatch" | "parsed" | "emailDraft" | "mhelpdeskPush" | "workOrderId"
    >
  >,
  options?: { expectedUpdatedAt?: string; failOnDispatchHold?: boolean }
) {
  return withFileLock("job-intake-write", async () => {
    const store = await loadJobIntakeStore();
    const existing = store.records.find((record) => record.id === id);
    if (!existing) throw new Error("Job intake record not found.");
    if (options?.expectedUpdatedAt && existing.updatedAt !== options.expectedUpdatedAt) {
      throw new Error("This intake changed while you were reviewing it. Recheck before taking action.");
    }
    if (options?.failOnDispatchHold && (existing.dispatchHold || existing.dispatch?.status === "withdrawn")) {
      throw new Error(existing.dispatchHold || "Dispatch withdrawn.");
    }

    const updated: JobIntakeRecord = {
      ...existing,
      ...patch,
      parsed: patch.parsed ? { ...existing.parsed, ...patch.parsed } : existing.parsed,
      updatedAt: new Date().toISOString(),
    };
    if (patch.notes !== undefined || patch.scheduledDate !== undefined || patch.parsed) {
      updated.mhelpdeskPush = {
        status: updated.mhelpdeskPush?.status ?? "needs_connection",
        fieldMap: buildMhelpdeskFieldMap(updated),
        updatedAt: new Date().toISOString(),
        error: updated.mhelpdeskPush?.error,
      };
    }

    store.records = store.records.map((record) => (record.id === id ? updated : record));
    await saveJobIntakeStore(store);
    return updated;
  });
}

export async function ensureSeedJobIntake() {
  const store = await loadJobIntakeStore();
  const pushStatus = await mhelpdeskPushStatus();
  if (!isDemoMode()) {
    const liveRecords = store.records.filter((record) => !isPlaceholderIntakeRecord(record));
    if (liveRecords.length !== store.records.length) {
      return saveJobIntakeStore({ ...store, records: liveRecords });
    }
    if (pushStatus === "ready" && store.records.some((record) => record.mhelpdeskPush?.status === "needs_connection")) {
      const records = store.records.map((record) =>
        record.mhelpdeskPush?.status === "needs_connection"
          ? {
              ...record,
              mhelpdeskPush: {
                ...record.mhelpdeskPush,
                status: "ready" as const,
                error: undefined,
                updatedAt: new Date().toISOString(),
              },
            }
          : record
      );
      return saveJobIntakeStore({ ...store, records });
    }
    return store;
  }
  if (store.records.length > 0) {
    if (pushStatus === "ready" && store.records.some((record) => record.mhelpdeskPush?.status === "needs_connection")) {
      const records = store.records.map((record) =>
        record.mhelpdeskPush?.status === "needs_connection"
          ? {
              ...record,
              mhelpdeskPush: {
                ...record.mhelpdeskPush,
                status: "ready" as const,
                error: undefined,
                updatedAt: new Date().toISOString(),
              },
            }
          : record
      );
      return saveJobIntakeStore({ ...store, records });
    }
    return store;
  }

  const sampleBody = `New work order assigned

Customer: Retail Facilities Group
Store #: 1842
Location: SuperMart #1842
Address: 1200 Commerce Pkwy
City: Dallas
State: TX
Zip: 75201
Work Order #: WO-45821
PO #: PO-99102
Description: Repair damaged chain link at loading dock
Details: Panel bent near dock door 3. Replace fabric and retension. Photo required before/after.
DNE: $850.00
Timeframe: Complete within 5 business days
Due: 07/24/2026
Priority: High
Contact: Site Manager Dana Ruiz
Phone: (214) 555-0198
Email: dana.ruiz@example.com`;

  await upsertJobIntakeFromSource({
    source: "manual",
    sourceRef: "seed-demo-wo-45821",
    subject: "Work Order Assigned · WO-45821 · Store 1842",
    from: "dispatch@mhelpdesk.example",
    snippet: "New work order assigned for SuperMart #1842",
    rawText: sampleBody,
    parsed: heuristicParse(sampleBody, "Work Order Assigned · WO-45821 · Store 1842"),
  });

  return loadJobIntakeStore();
}

/** Convert an accepted intake record into a tracker-friendly draft payload. */
export function intakeToWorkOrderDraft(record: JobIntakeRecord) {
  const p = record.parsed;
  const title =
    p.description ||
    [p.storeNumber ? `Store ${p.storeNumber}` : null, p.workOrderNumber].filter(Boolean).join(" · ") ||
    record.subject ||
    "Inbound job";

  return {
    title,
    scope_summary: [p.description, p.jobDetails, p.timeframe ? `Timeframe: ${p.timeframe}` : null, record.notes]
      .filter(Boolean)
      .join("\n\n"),
    trade_type: p.tradeType || "Facilities Maintenance",
    priority: p.priority || "Medium",
    status: "New",
    source: record.source === "gmail" ? "Email" : "Other",
    customer_work_order_number: p.workOrderNumber || null,
    purchase_order_number: p.purchaseOrderNumber || null,
    not_to_exceed_amount: p.dneAmount ?? null,
    requested_date: p.requestedDate || null,
    due_date: p.dueDate || null,
    scheduled_date: record.scheduledDate || null,
    customer_notes: [
      p.storeNumber ? `Store #: ${p.storeNumber}` : null,
      p.locationName ? `Location: ${p.locationName}` : null,
      [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ") || null,
      p.contactName ? `Contact: ${p.contactName}` : null,
      p.contactPhone ? `Phone: ${p.contactPhone}` : null,
      p.contactEmail ? `Email: ${p.contactEmail}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    internal_notes: `Imported from ${record.source} (${record.sourceRef})`,
  };
}
