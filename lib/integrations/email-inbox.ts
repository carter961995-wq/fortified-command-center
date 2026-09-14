import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  classifyEmail,
  detectDispatchSource,
  extractInboxIdentifiers,
  emailCategories,
  type DispatchSource,
  type EmailCategory,
} from "./email-classify";

export type InboxMessage = {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body?: string;
  category: EmailCategory;
  sourceHint: DispatchSource;
  workOrderNumber?: string;
  storeNumber?: string;
  linkedIntakeId?: string | null;
  updatedAt: string;
};

export type InboxStore = {
  updatedAt: string;
  messages: InboxMessage[];
};

function integrationDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

function inboxPath() {
  return path.join(integrationDir(), "email-inbox.json");
}

async function ensureDir() {
  await mkdir(integrationDir(), { recursive: true });
}

export async function loadEmailInboxStore(): Promise<InboxStore> {
  try {
    const raw = await readFile(inboxPath(), "utf8");
    const parsed = JSON.parse(raw) as InboxStore;
    return {
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return { updatedAt: new Date().toISOString(), messages: [] };
  }
}

export async function saveEmailInboxStore(store: InboxStore) {
  await ensureDir();
  const next = { ...store, updatedAt: new Date().toISOString() };
  await writeFile(inboxPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

export async function upsertInboxMessage(input: {
  id: string;
  threadId?: string;
  subject?: string;
  from?: string;
  date?: string;
  snippet?: string;
  body?: string;
  linkedIntakeId?: string | null;
}): Promise<{ message: InboxMessage; created: boolean }> {
  const store = await loadEmailInboxStore();
  const existing = store.messages.find((message) => message.id === input.id);
  const now = new Date().toISOString();
  const subject = input.subject ?? existing?.subject ?? "";
  const from = input.from ?? existing?.from ?? "";
  const snippet = input.snippet ?? existing?.snippet ?? "";
  const body = input.body ?? existing?.body;
  const classifiedFrom = { subject, from, snippet, body };
  const ids = extractInboxIdentifiers([subject, snippet, body].filter(Boolean).join("\n"));
  const message: InboxMessage = {
    id: input.id,
    threadId: input.threadId ?? existing?.threadId,
    subject,
    from,
    date: input.date ?? existing?.date ?? now,
    snippet,
    body,
    category: classifyEmail(classifiedFrom),
    sourceHint: detectDispatchSource(classifiedFrom),
    workOrderNumber: ids.workOrderNumber || existing?.workOrderNumber,
    storeNumber: ids.storeNumber || existing?.storeNumber,
    linkedIntakeId: input.linkedIntakeId ?? existing?.linkedIntakeId ?? null,
    updatedAt: now,
  };

  if (existing) {
    store.messages = store.messages.map((row) => (row.id === existing.id ? message : row));
    await saveEmailInboxStore(store);
    return { message, created: false };
  }

  store.messages.unshift(message);
  await saveEmailInboxStore(store);
  return { message, created: true };
}

export function searchInboxMessages(messages: InboxMessage[], query: string, category?: EmailCategory | "all") {
  const needle = query.trim().toLowerCase();
  return messages.filter((message) => {
    if (category && category !== "all" && message.category !== category) return false;
    if (!needle) return true;
    const haystack = [
      message.subject,
      message.from,
      message.snippet,
      message.body,
      message.workOrderNumber,
      message.storeNumber,
      message.sourceHint,
      message.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function inboxCounts(messages: InboxMessage[]) {
  const counts = Object.fromEntries(emailCategories.map((category) => [category, 0])) as Record<EmailCategory, number>;
  for (const message of messages) {
    counts[message.category] += 1;
  }
  return counts;
}
