import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { looksLikeJobAssignmentEmail, upsertJobIntakeFromSource } from "./job-intake";
import { looksLikeOperationalEmail } from "./email-classify";
import { upsertInboxMessage } from "./email-inbox";
import { isDemoMode } from "../env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
];

export const DEMO_GOOGLE_TOKEN = "demo-token";

export function isDemoGoogleConnection(connection: { accessToken?: string } | null | undefined) {
  const token = connection?.accessToken ?? "";
  return token === DEMO_GOOGLE_TOKEN || token.startsWith("demo-");
}

export type GoogleConnection = {
  provider: "google";
  email: string;
  name?: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
};

export type GoogleSyncSummary = {
  syncedAt: string;
  gmail: {
    messages: Array<{
      id: string;
      threadId: string;
      subject: string;
      from: string;
      date: string;
      snippet: string;
    }>;
  };
  drive: {
    files: Array<{
      id: string;
      name: string;
      mimeType: string;
      modifiedTime?: string;
      webViewLink?: string;
    }>;
  };
  calendar: {
    events: Array<{
      id: string;
      summary: string;
      start?: string;
      end?: string;
    }>;
  };
  jobIntake?: {
    scanned: number;
    imported: number;
    updated: number;
    records: Array<{
      id: string;
      sourceRef: string;
      workOrderNumber?: string;
      storeNumber?: string;
      description?: string;
      created: boolean;
    }>;
  };
  inbox?: {
    scanned: number;
    imported: number;
    updated: number;
    counts: Record<string, number>;
  };
  gemini?: {
    configured: boolean;
    extraction?: unknown;
    error?: string;
  };
};

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type UserInfo = {
  email?: string;
  name?: string;
  picture?: string;
};

function integrationDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

function connectionPath() {
  return path.join(integrationDir(), "google-connection.json");
}

function syncPath() {
  return path.join(integrationDir(), "google-last-sync.json");
}

async function ensureDir() {
  await mkdir(integrationDir(), { recursive: true });
}

export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function googleRedirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/integrations/google/callback`;
}

export function googleAuthUrl({ origin, state }: { origin: string; state: string }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: googleScopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function loadGoogleConnection(): Promise<GoogleConnection | null> {
  try {
    const raw = await readFile(connectionPath(), "utf8");
    return JSON.parse(raw) as GoogleConnection;
  } catch {
    return null;
  }
}

export async function saveGoogleConnection(connection: GoogleConnection) {
  await ensureDir();
  await writeFile(connectionPath(), JSON.stringify(connection, null, 2), { mode: 0o600 });
}

export async function deleteGoogleConnection() {
  await rm(connectionPath(), { force: true });
}

export async function loadLastSync(): Promise<GoogleSyncSummary | null> {
  try {
    const raw = await readFile(syncPath(), "utf8");
    return JSON.parse(raw) as GoogleSyncSummary;
  } catch {
    return null;
  }
}

export async function saveLastSync(summary: GoogleSyncSummary) {
  await ensureDir();
  await writeFile(syncPath(), JSON.stringify(summary, null, 2), { mode: 0o600 });
}

export async function exchangeGoogleCode({ code, origin }: { code: string; origin: string }) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const token = (await response.json()) as TokenResponse;
  if (!response.ok || token.error || !token.access_token) {
    throw new Error(token.error_description || token.error || "Google token exchange failed.");
  }

  const userInfo = await fetchGoogleUserInfo(token.access_token);
  const previous = await loadGoogleConnection();
  const now = new Date().toISOString();
  const connection: GoogleConnection = {
    provider: "google",
    email: userInfo.email || previous?.email || "unknown@google",
    name: userInfo.name || previous?.name,
    picture: userInfo.picture || previous?.picture,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || previous?.refreshToken,
    expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
    scopes: token.scope ? token.scope.split(" ") : googleScopes,
    connectedAt: previous?.connectedAt || now,
    updatedAt: now,
  };
  await saveGoogleConnection(connection);
  return connection;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  return (await response.json()) as UserInfo;
}

export async function getValidGoogleAccessToken() {
  const connection = await loadGoogleConnection();
  if (!connection) throw new Error("Google is not connected.");

  if (isDemoGoogleConnection(connection)) {
    if (!isDemoMode()) {
      await deleteGoogleConnection();
      throw new Error(
        "The connected Gmail mailbox was a sample inbox, not your real mail. Sign in with Google on Job Sources to pull live work orders, bids, and quotes."
      );
    }
    return { accessToken: connection.accessToken, connection };
  }

  if (connection.expiresAt > Date.now() + 60_000) {
    return { accessToken: connection.accessToken, connection };
  }

  if (!connection.refreshToken) {
    throw new Error("Google refresh token is missing. Reconnect Google Workspace.");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = (await response.json()) as TokenResponse;
  if (!response.ok || token.error || !token.access_token) {
    throw new Error(token.error_description || token.error || "Google token refresh failed.");
  }

  const updated: GoogleConnection = {
    ...connection,
    accessToken: token.access_token,
    expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
    scopes: token.scope ? token.scope.split(" ") : connection.scopes,
    updatedAt: new Date().toISOString(),
  };
  await saveGoogleConnection(updated);
  return { accessToken: updated.accessToken, connection: updated };
}

async function googleApi<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Google API request failed: ${url}`);
  }
  return (await response.json()) as T;
}

function headerValue(headers: Array<{ name: string; value: string }> | undefined, name: string) {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};

function decodeBase64Url(data?: string) {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function collectTextParts(part?: GmailPart): string[] {
  if (!part) return [];
  const chunks: string[] = [];
  if (part.mimeType?.startsWith("text/") && part.body?.data) {
    chunks.push(decodeBase64Url(part.body.data));
  }
  for (const child of part.parts ?? []) {
    chunks.push(...collectTextParts(child));
  }
  return chunks;
}

function extractGmailBody(payload?: GmailPart) {
  const chunks = collectTextParts(payload);
  if (chunks.length) return chunks.join("\n\n").trim();
  if (payload?.body?.data) return decodeBase64Url(payload.body.data).trim();
  return "";
}

async function ingestGmailMessages(
  accessToken: string,
  messages: GoogleSyncSummary["gmail"]["messages"]
): Promise<{
  jobIntake: NonNullable<GoogleSyncSummary["jobIntake"]>;
  inbox: NonNullable<GoogleSyncSummary["inbox"]>;
}> {
  const operational = messages.filter((message) =>
    looksLikeOperationalEmail({
      subject: message.subject,
      from: message.from,
      snippet: message.snippet,
    })
  );

  const records: NonNullable<GoogleSyncSummary["jobIntake"]>["records"] = [];
  let imported = 0;
  let updated = 0;
  let inboxImported = 0;
  let inboxUpdated = 0;
  const counts: Record<string, number> = {};

  for (const message of messages.slice(0, 80)) {
    const needsBody =
      looksLikeJobAssignmentEmail({
        subject: message.subject,
        from: message.from,
        snippet: message.snippet,
      }) ||
      looksLikeOperationalEmail({
        subject: message.subject,
        from: message.from,
        snippet: message.snippet,
      }) ||
      /mhelpdesk|truesource|affiliate.?connect/i.test(`${message.subject} ${message.from} ${message.snippet}`);

    let body = message.snippet;
    let receivedAt = message.date ? new Date(message.date).toISOString() : new Date().toISOString();
    if (needsBody) {
      const detail = await googleApi<{
        id: string;
        snippet?: string;
        internalDate?: string;
        payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
      }>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
        accessToken
      );
      body = extractGmailBody(detail.payload) || detail.snippet || message.snippet;
      receivedAt = detail.internalDate
        ? new Date(Number(detail.internalDate)).toISOString()
        : receivedAt;
    }

    const inbox = await upsertInboxMessage({
      id: message.id,
      threadId: message.threadId,
      subject: message.subject,
      from: message.from,
      date: receivedAt,
      snippet: message.snippet,
      body,
    });
    if (inbox.created) inboxImported += 1;
    else inboxUpdated += 1;
    counts[inbox.message.category] = (counts[inbox.message.category] ?? 0) + 1;

    if (
      !looksLikeJobAssignmentEmail({
        subject: message.subject,
        from: message.from,
        snippet: message.snippet,
        body,
      })
    ) {
      continue;
    }

    const { record, created } = await upsertJobIntakeFromSource({
      source: "gmail",
      sourceRef: message.id,
      receivedAt,
      subject: message.subject,
      from: message.from,
      snippet: message.snippet,
      rawText: body,
    });

    if (created) imported += 1;
    else updated += 1;

    records.push({
      id: record.id,
      sourceRef: record.sourceRef,
      workOrderNumber: record.parsed.workOrderNumber,
      storeNumber: record.parsed.storeNumber,
      description: record.parsed.description,
      created,
    });

    await upsertInboxMessage({
      id: message.id,
      linkedIntakeId: record.id,
    });
  }

  return {
    jobIntake: {
      scanned: operational.length,
      imported,
      updated,
      records,
    },
    inbox: {
      scanned: messages.length,
      imported: inboxImported,
      updated: inboxUpdated,
      counts,
    },
  };
}

const GMAIL_JOB_QUERIES = [
  'newer_than:120d (mhelpdesk OR mhelpdesk.com OR "m help desk")',
  'newer_than:120d (truesource OR "true source" OR "affiliate connect" OR affiliateconnect)',
  'newer_than:120d ("work order" OR workorder OR "WO#" OR "WO #" OR "ticket assigned" OR dispatch)',
  'newer_than:120d ("invitation to bid" OR ITB OR RFP OR RFQ OR "request for quote" OR "request for proposal" OR "bid request" OR "please bid")',
  'newer_than:120d ("quote approved" OR "approved quote" OR "notice to proceed" OR "quote submitted" OR quoted)',
  'newer_than:60d (invoice OR remittance OR "payment received")',
];

export async function sendApprovedGmailDraft(input: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}) {
  const { accessToken, connection } = await getValidGoogleAccessToken();
  if (isDemoMode() || isDemoGoogleConnection(connection)) {
    return { id: `demo-gmail-${Date.now()}`, threadId: `demo-thread-${Date.now()}` };
  }
  const headers = [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : null,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=utf-8",
  ]
    .filter(Boolean)
    .join("\r\n");

  const raw = `${headers}\r\n\r\n${input.body}`;
  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Failed to send Gmail message.");
  }
  return data as { id: string; threadId?: string };
}

async function syncDemoGoogleWorkspace(connection: GoogleConnection): Promise<GoogleSyncSummary> {
  const now = new Date().toISOString();
  const messages = [
    {
      id: "demo-gmail-mhelpdesk",
      threadId: "demo-thread-mhelpdesk",
      subject: "mHelpDesk · Work order assigned · Store 104",
      from: "alerts@mhelpdesk.com",
      date: now,
      snippet: "New job assigned: Canal Street Store gate operator reverse fault.",
    },
    {
      id: "demo-gmail-truesource",
      threadId: "demo-thread-truesource",
      subject: "TrueSource Affiliate Connect · Ticket assigned",
      from: "dispatch@truesource.com",
      date: now,
      snippet: "Affiliate Connect assignment for Kenner Shopping Center dock gate.",
    },
    {
      id: "demo-gmail-internal",
      threadId: "demo-thread-internal",
      subject: "Work order WO-45821 assigned · Store 1842",
      from: "jobs@fortified.local",
      date: now,
      snippet: "Repair damaged chain link at loading dock. DNE $850.",
    },
    {
      id: "demo-gmail-itb",
      threadId: "demo-thread-itb",
      subject: "Invitation to Bid · Store 219 bollard replacement",
      from: "procurement@bayou-retail.example",
      date: now,
      snippet: "Please bid the entry-drive bollard sleeve replacement at Kenner Shopping Center.",
    },
    {
      id: "demo-gmail-quoted",
      threadId: "demo-thread-quoted",
      subject: "Quote submitted · WO-45821 loading dock fence",
      from: "quotes@fortified.local",
      date: now,
      snippet: "Our quote was sent for the SuperMart #1842 dock fence repair.",
    },
    {
      id: "demo-gmail-approved",
      threadId: "demo-thread-approved",
      subject: "Quote approved · PO-99102 · Store 1842",
      from: "ap@retail-facilities.example",
      date: now,
      snippet: "Your quote was approved. PO-99102 is attached. Notice to proceed.",
    },
    {
      id: "demo-gmail-invoice",
      threadId: "demo-thread-invoice",
      subject: "Invoice INV-2041 remittance",
      from: "ap@bayou-retail.example",
      date: now,
      snippet: "Payment received for invoice INV-2041. Remittance attached.",
    },
  ];

  const bodies: Record<string, string> = {
    "demo-gmail-mhelpdesk": `mHelpDesk assignment
Customer: Bayou Retail Group
Store #: 104
Location: Canal Street Store
Address: 410 Canal St
City: New Orleans
State: LA
Zip: 70130
Work Order #: MHD-10418
Description: Gate operator reverse fault
Details: Operator reverses mid-cycle. Check photo eyes and close limits.
DNE: $1200.00
Timeframe: Next available business day
Priority: Urgent
Contact: Tina Flores
Phone: 504-555-0138
Email: canal-store@bayou-retail.example`,
    "demo-gmail-truesource": `TrueSource Affiliate Connect assignment
Customer: Bayou Retail Group
Store #: 219
Location: Kenner Shopping Center
Address: 2800 Veterans Blvd
City: Kenner
State: LA
Zip: 70062
Work Order #: TS-21944
Description: Dock safety gate inspection
Details: Affiliate Connect dispatch. Inspect adjacent safety gate and operator.
DNE: $1800.00
Timeframe: 24 hour response
Priority: High
Contact: TrueSource Dispatch
Email: dispatch@truesource.com`,
    "demo-gmail-internal": `New work order assigned
Customer: Retail Facilities Group
Store #: 1842
Location: SuperMart #1842
Address: 1200 Commerce Pkwy
City: Dallas
State: TX
Zip: 75201
Work Order #: WO-45821
Description: Repair damaged chain link at loading dock
Details: Panel bent near dock door 3. Replace fabric and retension.
DNE: $850.00
Timeframe: Complete within 5 business days
Priority: High
Contact: Dana Ruiz
Phone: (214) 555-0198
Email: dana.ruiz@example.com`,
    "demo-gmail-itb": `Invitation to Bid
Customer: Bayou Retail Group
Store #: 219
Location: Kenner Shopping Center
Address: 2800 Veterans Blvd
City: Kenner
State: LA
Zip: 70062
Work Order #: ITB-21908
Description: Replace cracked bollard sleeves at main entry
Details: Please bid labor, sleeves, and recore. Photos attached.
Timeframe: Bid due in 3 business days
Priority: Medium
Contact: Drew Patel
Email: kenner@bayou-retail.example`,
    "demo-gmail-quoted": `Quote submitted
Customer: Retail Facilities Group
Store #: 1842
Location: SuperMart #1842
Work Order #: WO-45821
Description: Repair damaged chain link at loading dock
Details: Quote sent to customer. Waiting on approval.
Quoted: Yes
DNE: $850.00
Email: dana.ruiz@example.com`,
    "demo-gmail-approved": `Quote approved
Customer: Retail Facilities Group
Store #: 1842
Location: SuperMart #1842
Work Order #: WO-45821
PO #: PO-99102
Description: Repair damaged chain link at loading dock
Details: Your quote was approved. Notice to proceed. Schedule this week.
Priority: High
Email: ap@retail-facilities.example`,
    "demo-gmail-invoice": `Invoice remittance
Customer: Bayou Retail Group
Invoice #: INV-2041
Work Order #: MHD-10418
Details: Payment received. Remittance attached.`,
  };

  const records: NonNullable<GoogleSyncSummary["jobIntake"]>["records"] = [];
  let imported = 0;
  let updated = 0;
  let inboxImported = 0;
  let inboxUpdated = 0;
  const counts: Record<string, number> = {};

  for (const message of messages) {
    const rawText = bodies[message.id] ?? message.snippet;
    const inbox = await upsertInboxMessage({
      id: message.id,
      threadId: message.threadId,
      subject: message.subject,
      from: message.from,
      date: now,
      snippet: message.snippet,
      body: rawText,
    });
    if (inbox.created) inboxImported += 1;
    else inboxUpdated += 1;
    counts[inbox.message.category] = (counts[inbox.message.category] ?? 0) + 1;

    if (
      !looksLikeJobAssignmentEmail({
        subject: message.subject,
        from: message.from,
        snippet: message.snippet,
        body: rawText,
      })
    ) {
      continue;
    }

    const { record, created } = await upsertJobIntakeFromSource({
      source: "gmail",
      sourceRef: message.id,
      receivedAt: now,
      subject: message.subject,
      from: message.from,
      snippet: message.snippet,
      rawText,
    });
    if (created) imported += 1;
    else updated += 1;
    records.push({
      id: record.id,
      sourceRef: record.sourceRef,
      workOrderNumber: record.parsed.workOrderNumber,
      storeNumber: record.parsed.storeNumber,
      description: record.parsed.description,
      created,
    });
    await upsertInboxMessage({ id: message.id, linkedIntakeId: record.id });
  }

  const summary: GoogleSyncSummary = {
    syncedAt: now,
    gmail: { messages },
    drive: {
      files: [
        {
          id: "demo-drive-site-photo",
          name: "Canal-Street-gate-photo.jpg",
          mimeType: "image/jpeg",
          modifiedTime: now,
          webViewLink: "https://drive.google.com/file/d/demo-drive-site-photo/view",
        },
      ],
    },
    calendar: {
      events: [
        {
          id: "demo-cal-site",
          summary: "Site visit · Canal Street Store",
          start: now,
          end: now,
        },
      ],
    },
    jobIntake: {
      scanned: messages.length,
      imported,
      updated,
      records,
    },
    inbox: {
      scanned: messages.length,
      imported: inboxImported,
      updated: inboxUpdated,
      counts,
    },
    gemini: { configured: Boolean(process.env.GEMINI_API_KEY) },
  };

  const updatedConnection: GoogleConnection = { ...connection, updatedAt: now };
  await saveGoogleConnection(updatedConnection);
  await saveLastSync(summary);
  return summary;
}

export async function syncGoogleWorkspace() {
  const connection = await loadGoogleConnection();
  if (!connection) throw new Error("Google is not connected.");
  if (isDemoGoogleConnection(connection) && !isDemoMode()) {
    await deleteGoogleConnection();
    throw new Error(
      "The connected Gmail mailbox was a sample inbox, not your real mail. Sign in with Google on Job Sources to pull live work orders, bids, and quotes."
    );
  }
  if (isDemoMode() && isDemoGoogleConnection(connection)) {
    return syncDemoGoogleWorkspace(connection);
  }
  const { accessToken } = await getValidGoogleAccessToken();
  const mergedIds = new Map<string, { id: string; threadId: string }>();
  for (const query of GMAIL_JOB_QUERIES) {
    try {
      const listed = await googleApi<{ messages?: Array<{ id: string; threadId: string }> }>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(query)}`,
        accessToken
      );
      for (const message of listed.messages ?? []) mergedIds.set(message.id, message);
    } catch {
      continue;
    }
  }

  const messages = await Promise.all(
    Array.from(mergedIds.values())
      .slice(0, 80)
      .map(async (message) => {
        const detail = await googleApi<{
          id: string;
          threadId: string;
          snippet?: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        }>(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          accessToken
        );
        return {
          id: detail.id,
          threadId: detail.threadId,
          subject: headerValue(detail.payload?.headers, "Subject"),
          from: headerValue(detail.payload?.headers, "From"),
          date: headerValue(detail.payload?.headers, "Date"),
          snippet: detail.snippet ?? "",
        };
      })
  );

  const drive = await googleApi<{
    files?: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string }>;
  }>(
    "https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime%20desc",
    accessToken
  );

  const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const calendar = await googleApi<{
    items?: Array<{ id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }>;
  }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
    accessToken
  );

  const ingested = await ingestGmailMessages(accessToken, messages);

  const summary: GoogleSyncSummary = {
    syncedAt: new Date().toISOString(),
    gmail: { messages },
    drive: { files: drive.files ?? [] },
    calendar: {
      events: (calendar.items ?? []).map((event) => ({
        id: event.id,
        summary: event.summary ?? "Untitled event",
        start: event.start?.dateTime ?? event.start?.date,
        end: event.end?.dateTime ?? event.end?.date,
      })),
    },
    jobIntake: ingested.jobIntake,
    inbox: ingested.inbox,
    gemini: await runGeminiExtraction(messages, drive.files ?? []),
  };

  await saveLastSync(summary);
  return summary;
}

async function runGeminiExtraction(
  messages: GoogleSyncSummary["gmail"]["messages"],
  files: GoogleSyncSummary["drive"]["files"]
): Promise<GoogleSyncSummary["gemini"]> {
  if (!process.env.GEMINI_API_KEY) return { configured: false };
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const prompt = `You are helping a fence company extract operational records.
Return compact JSON with arrays named leads, work_orders, contacts, invoice_tasks.
Use these Gmail messages and Drive files as source material:
${JSON.stringify({ messages, files }, null, 2)}`;

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
    if (!response.ok) {
      return { configured: true, error: data?.error?.message || "Gemini extraction failed." };
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return { configured: true, extraction: text ? JSON.parse(text) : data };
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : "Gemini extraction failed." };
  }
}
