import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type JobIntakeSource = "gmail" | "mhelpdesk" | "manual";

export type JobIntakeStatus = "new" | "reviewed" | "tracked" | "dismissed";

export type ParsedJobFields = {
  customerName?: string;
  storeNumber?: string;
  locationName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  workOrderNumber?: string;
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

export type JobEmailDraft = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  status: "draft" | "approved" | "sent";
  updatedAt: string;
  sentAt?: string;
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
  receivedAt: string;
  subject?: string;
  from?: string;
  snippet?: string;
  rawText: string;
  parsed: ParsedJobFields;
  notes: string;
  scheduledDate?: string | null;
  photoUrls: string[];
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
  /\b(work\s*order|wo[#:\s-]|job\s*assigned|new\s*job|service\s*request|dispatch|store\s*#|dne|n\.?t\.?e\.?|not\s*to\s*exceed|mhelp|mhelpdesk|ticket\s*#)\b/i;

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
  await writeFile(intakePath(), JSON.stringify(next, null, 2), { mode: 0o600 });
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

function heuristicParse(rawText: string, subject?: string): ParsedJobFields {
  // Prefer body over subject so short subjects like "WO assigned" do not steal identifiers.
  const text = `${rawText}\n${subject ?? ""}`;
  const pick = (re: RegExp) => text.match(re)?.[1]?.trim();
  const label = "[\\s:#!-]*";

  const dneRaw = pick(new RegExp(`\\b(?:DNE|NTE|Not\\s*to\\s*Exceed)${label}\\$?\\s*([0-9,.]+)`, "i"));
  const dneAmount = dneRaw ? Number(dneRaw.replace(/,/g, "")) : null;

  return {
    workOrderNumber:
      pick(new RegExp(`\\bWork\\s*Order${label}([A-Z0-9-]{2,})`, "i")) ||
      pick(new RegExp(`\\b(?:WO|W\\.O\\.)${label}([A-Z0-9]*\\d[A-Z0-9-]*)`, "i")),
    purchaseOrderNumber:
      pick(new RegExp(`\\bPurchase\\s*Order${label}([A-Z0-9-]{2,})`, "i")) ||
      pick(new RegExp(`\\b(?:PO|P\\.O\\.)${label}([A-Z0-9]*\\d[A-Z0-9-]*)`, "i")),
    storeNumber: pick(new RegExp(`\\bStore${label}([A-Z0-9-]{1,})`, "i")),
    customerName: pick(new RegExp(`\\b(?:Customer|Client|Account)${label}([^\\n]+)`, "i")),
    locationName: pick(new RegExp(`\\b(?:Location|Site|Facility)${label}([^\\n]+)`, "i")),
    address: pick(new RegExp(`\\b(?:Address|Job\\s*Site)${label}([^\\n]+)`, "i")),
    city: pick(new RegExp(`\\bCity${label}([^\\n]+)`, "i")),
    state: pick(new RegExp(`\\bState${label}([A-Z]{2})\\b`, "i")),
    zip: pick(new RegExp(`\\b(?:Zip|Postal)${label}(\\d{5}(?:-\\d{4})?)`, "i")),
    description: pick(new RegExp(`\\b(?:Description|Issue|Problem|Scope)${label}([^\\n]+)`, "i")) || subject,
    jobDetails: pick(new RegExp(`\\b(?:Details|Instructions|Notes)${label}([\\s\\S]{0,500})`, "i")),
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

export async function upsertJobIntakeFromSource(input: {
  source: JobIntakeSource;
  sourceRef: string;
  receivedAt?: string;
  subject?: string;
  from?: string;
  snippet?: string;
  rawText: string;
  parsed?: ParsedJobFields;
}): Promise<{ record: JobIntakeRecord; created: boolean }> {
  const store = await loadJobIntakeStore();
  const existing = store.records.find((record) => record.source === input.source && record.sourceRef === input.sourceRef);
  const now = new Date().toISOString();
  const parsed = input.parsed ?? (await parseJobAssignmentText({
    subject: input.subject,
    from: input.from,
    body: input.rawText,
  }));

  if (existing) {
    const updated: JobIntakeRecord = {
      ...existing,
      subject: input.subject ?? existing.subject,
      from: input.from ?? existing.from,
      snippet: input.snippet ?? existing.snippet,
      rawText: input.rawText || existing.rawText,
      parsed: { ...existing.parsed, ...parsed },
      updatedAt: now,
    };
    store.records = store.records.map((record) => (record.id === existing.id ? updated : record));
    await saveJobIntakeStore(store);
    return { record: updated, created: false };
  }

  const record: JobIntakeRecord = {
    id: randomUUID(),
    status: "new",
    source: input.source,
    sourceRef: input.sourceRef,
    receivedAt: input.receivedAt ?? now,
    subject: input.subject,
    from: input.from,
    snippet: input.snippet,
    rawText: input.rawText,
    parsed,
    notes: "",
    scheduledDate: parsed.dueDate ?? null,
    photoUrls: [],
    workOrderId: null,
    emailDraft: null,
    mhelpdeskPush: {
      status: "needs_connection",
      fieldMap: buildMhelpdeskFieldMap({
        id: "tmp",
        status: "new",
        source: input.source,
        sourceRef: input.sourceRef,
        receivedAt: input.receivedAt ?? now,
        rawText: input.rawText,
        parsed,
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
    status: "needs_connection",
    fieldMap: buildMhelpdeskFieldMap(record),
    updatedAt: now,
  };

  store.records.unshift(record);
  await saveJobIntakeStore(store);
  return { record, created: true };
}

export async function getJobIntakeRecord(id: string) {
  const store = await loadJobIntakeStore();
  return store.records.find((record) => record.id === id) ?? null;
}

export async function updateJobIntakeRecord(
  id: string,
  patch: Partial<
    Pick<JobIntakeRecord, "status" | "notes" | "scheduledDate" | "photoUrls" | "parsed" | "emailDraft" | "mhelpdeskPush" | "workOrderId">
  >
) {
  const store = await loadJobIntakeStore();
  const existing = store.records.find((record) => record.id === id);
  if (!existing) throw new Error("Job intake record not found.");

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
}

export async function ensureSeedJobIntake() {
  const store = await loadJobIntakeStore();
  if (store.records.length > 0) return store;

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
    scope_summary: [p.jobDetails, p.timeframe ? `Timeframe: ${p.timeframe}` : null, record.notes]
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
