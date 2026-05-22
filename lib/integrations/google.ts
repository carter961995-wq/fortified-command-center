import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
];

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

export async function syncGoogleWorkspace() {
  const { accessToken } = await getValidGoogleAccessToken();
  const gmailList = await googleApi<{ messages?: Array<{ id: string; threadId: string }> }>(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=newer_than:30d",
    accessToken
  );

  const messages = await Promise.all(
    (gmailList.messages ?? []).slice(0, 10).map(async (message) => {
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
