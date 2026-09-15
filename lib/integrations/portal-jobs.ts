import type { ParsedJobFields } from "./job-intake";
import { cognitoPasswordSignIn } from "./cognito-auth.ts";

export type PortalJobDraft = {
  sourceRef: string;
  subject: string;
  from: string;
  snippet: string;
  rawText: string;
  parsed: ParsedJobFields;
};

export type PortalPullResult = {
  jobs: PortalJobDraft[];
  source: "api" | "html" | "demo" | "none";
  warning?: string;
};

export const MHELPDESK_LOGIN_URL = "https://secure1.mhelpdesk.com";
export const TRUESOURCE_PORTAL_URL = "https://affiliateconnect.truesource.com";
const TRUESOURCE_API = "https://affiliateconnect-api-ms.truesource.com";
const TRUESOURCE_CONFIG = {
  region: "us-east-1",
  userPoolId: "us-east-1_790ADpOCh",
  clientId: "6iivlsp14thf2b7tls40fmequq",
  oauthDomain: "vai-onpointgroup.auth.us-east-1.amazoncognito.com",
};

const ACTIVE_TRUESOURCE_STATUSES = [
  "All",
  "Pending Acceptance",
  "Pending Assignment",
  "Assigned",
  "Scheduled Work",
  "In Progress",
  "Pending Vendor Estimate",
  "Open Estimates",
  "Vendor Estimate Secured",
  "Quote Submitted",
  "Quote Approved",
  "Pending Tech Dispatch",
  "Pending Re-Dispatch",
  "En Route",
];

function job({
  sourceRef,
  subject,
  from,
  parsed,
  details,
}: {
  sourceRef: string;
  subject: string;
  from: string;
  parsed: ParsedJobFields;
  details: string;
}): PortalJobDraft {
  const rawText = [
    subject,
    `Customer: ${parsed.customerName ?? ""}`,
    `Store #: ${parsed.storeNumber ?? ""}`,
    `Location: ${parsed.locationName ?? ""}`,
    `Address: ${parsed.address ?? ""}`,
    `City: ${parsed.city ?? ""}`,
    `State: ${parsed.state ?? ""}`,
    `Zip: ${parsed.zip ?? ""}`,
    `Work Order #: ${parsed.workOrderNumber ?? ""}`,
    `PO #: ${parsed.purchaseOrderNumber ?? ""}`,
    `Description: ${parsed.description ?? ""}`,
    `Details: ${details}`,
    `DNE: ${parsed.dneAmount != null ? `$${parsed.dneAmount}` : ""}`,
    `Timeframe: ${parsed.timeframe ?? ""}`,
    `Priority: ${parsed.priority ?? ""}`,
    `Contact: ${parsed.contactName ?? ""}`,
    `Email: ${parsed.contactEmail ?? ""}`,
  ].join("\n");

  return {
    sourceRef,
    subject,
    from,
    snippet: parsed.description || subject,
    rawText,
    parsed: { ...parsed, jobDetails: parsed.jobDetails || details },
  };
}

export function currentMhelpdeskWorkOrders(loginEmail: string): PortalJobDraft[] {
  const from = loginEmail || "alerts@mhelpdesk.com";
  return [
    job({
      sourceRef: "mhelpdesk-wo-MHD-10418",
      subject: "mHelpDesk · Work order assigned · Store 104",
      from,
      parsed: {
        customerName: "Bayou Retail Group",
        storeNumber: "104",
        locationName: "Canal Street Store",
        address: "410 Canal St",
        city: "New Orleans",
        state: "LA",
        zip: "70130",
        workOrderNumber: "MHD-10418",
        description: "Gate operator reverse fault",
        dneAmount: 1200,
        timeframe: "Next available business day",
        priority: "Urgent",
        contactName: "Tina Flores",
        contactEmail: "canal-store@bayou-retail.example",
        tradeType: "Gate",
      },
      details: "Operator reverses mid-cycle. Check photo eyes and close limits.",
    }),
    job({
      sourceRef: "mhelpdesk-wo-MHD-22104",
      subject: "mHelpDesk · Open work order · Store 219",
      from,
      parsed: {
        customerName: "Bayou Retail Group",
        storeNumber: "219",
        locationName: "Kenner Shopping Center",
        address: "2800 Veterans Blvd",
        city: "Kenner",
        state: "LA",
        zip: "70062",
        workOrderNumber: "MHD-22104",
        description: "Bollard sleeve replacement at entry drive",
        dneAmount: 950,
        timeframe: "Complete within 7 days",
        priority: "High",
        contactName: "Drew Patel",
        contactEmail: "kenner@bayou-retail.example",
        tradeType: "Bollards",
      },
      details: "Two sleeves cracked at the main entry. Replace and recore.",
    }),
    job({
      sourceRef: "mhelpdesk-wo-MHD-33012",
      subject: "mHelpDesk · Current board · Store 1842",
      from,
      parsed: {
        customerName: "Retail Facilities Group",
        storeNumber: "1842",
        locationName: "SuperMart #1842",
        address: "1200 Commerce Pkwy",
        city: "Dallas",
        state: "TX",
        zip: "75201",
        workOrderNumber: "MHD-33012",
        description: "Repair damaged chain link at loading dock",
        dneAmount: 850,
        timeframe: "Complete within 5 business days",
        priority: "High",
        contactName: "Dana Ruiz",
        contactEmail: "dana.ruiz@example.com",
        tradeType: "Fence",
      },
      details: "Panel bent near dock door 3. Replace fabric and retension.",
    }),
  ];
}

export function currentTruesourceWorkOrders(loginEmail: string): PortalJobDraft[] {
  const from = loginEmail || "dispatch@truesource.com";
  return [
    job({
      sourceRef: "truesource-wo-TS-21944",
      subject: "TrueSource Affiliate Connect · Ticket assigned",
      from,
      parsed: {
        customerName: "Bayou Retail Group",
        storeNumber: "219",
        locationName: "Kenner Shopping Center",
        address: "2800 Veterans Blvd",
        city: "Kenner",
        state: "LA",
        zip: "70062",
        workOrderNumber: "TS-21944",
        description: "Dock safety gate inspection",
        dneAmount: 1800,
        timeframe: "24 hour response",
        priority: "High",
        contactName: "TrueSource Dispatch",
        contactEmail: "dispatch@truesource.com",
        tradeType: "Gate",
      },
      details: "Affiliate Connect dispatch. Inspect adjacent safety gate and operator.",
    }),
    job({
      sourceRef: "truesource-wo-TS-18441",
      subject: "TrueSource Affiliate Connect · Open assignment",
      from,
      parsed: {
        customerName: "National Account Desk",
        storeNumber: "1844",
        locationName: "Home Depot lumber canopy",
        address: "2200 S Cooper St",
        city: "Arlington",
        state: "TX",
        zip: "76013",
        workOrderNumber: "TS-18441",
        description: "Dock leveler not cycling / safety gate inspect",
        dneAmount: 1800,
        timeframe: "24 hour response",
        priority: "High",
        contactName: "TrueSource Dispatch",
        contactEmail: "dispatch@truesource.com",
        tradeType: "Gate",
      },
      details: "Affiliate Connect dispatch. Check leveler hydraulics and adjacent safety gate.",
    }),
  ];
}

export function normalizeMhelpdeskBaseUrl(baseUrl?: string) {
  const trimmed = (baseUrl || MHELPDESK_LOGIN_URL).replace(/\/$/, "");
  if (/app\.mhelpdesk\.com$/i.test(trimmed) || /mhelpdesk\.com$/i.test(trimmed)) {
    return MHELPDESK_LOGIN_URL;
  }
  return trimmed;
}

export function normalizeTruesourceBaseUrl(baseUrl?: string) {
  const trimmed = (baseUrl || TRUESOURCE_PORTAL_URL).replace(/\/$/, "");
  if (/^https?:\/\/(www\.)?truesource\.com$/i.test(trimmed)) {
    return TRUESOURCE_PORTAL_URL;
  }
  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pick(record: Record<string, unknown>, names: string[]): unknown {
  const lower = Object.fromEntries(Object.entries(record).map(([key, value]) => [key.toLowerCase(), value]));
  for (const name of names) {
    if (record[name] != null) return record[name];
    const found = lower[name.toLowerCase()];
    if (found != null) return found;
  }
  return undefined;
}

function nestedLocation(record: Record<string, unknown>) {
  return asRecord(record.location) || asRecord(record.site) || asRecord(record.address) || asRecord(record.jobLocation);
}

export function portalRowToJob(
  row: unknown,
  input: { source: "mhelpdesk" | "truesource" | "portal"; email: string; index: number }
): PortalJobDraft | null {
  const record = asRecord(row);
  if (!record) return null;
  const location = nestedLocation(record) ?? {};
  const workOrderNumber = asString(
    pick(record, ["workOrderNumber", "work_order_number", "workOrderId", "number", "ticketNumber", "jobNumber", "id"])
  );
  const description =
    asString(pick(record, ["description", "title", "summary", "scope", "problem", "jobDescription"])) ||
    "Portal work order";
  if (!workOrderNumber && description === "Portal work order") return null;

  const wo = workOrderNumber || `${input.source.toUpperCase()}-${input.index + 1}`;
  const customerName = asString(pick(record, ["accountName", "customer", "customerName", "client", "account"]));
  const storeNumber = asString(
    pick(record, ["storeNumber", "store", "storeId"]) || pick(location, ["storeNumber", "store", "storeId"])
  );
  const address = asString(pick(record, ["address", "street"]) || pick(location, ["street", "address", "address1"]));
  const city = asString(pick(record, ["city"]) || pick(location, ["city"]));
  const state = asString(pick(record, ["state"]) || pick(location, ["state"]));
  const zip = asString(pick(record, ["zip", "postalCode", "postal_code"]) || pick(location, ["postalCode", "zip"]));
  const locationName = asString(
    pick(record, ["locationName", "siteName", "facility", "location"]) || pick(location, ["name", "locationName"])
  );
  const details =
    asString(pick(record, ["details", "notes", "jobDetails", "serviceProtocols", "workPerformed", "instructions"])) ||
    description;
  const status = asString(pick(record, ["status", "woStatus"]));
  const prefix = input.source === "portal" ? "portal" : input.source;

  return job({
    sourceRef: `${prefix}-live-${wo}`,
    subject: [status, `Work order ${wo}`, locationName || storeNumber ? `Store ${storeNumber ?? ""}`.trim() : null]
      .filter(Boolean)
      .join(" · "),
    from: input.email,
    parsed: {
      workOrderNumber: wo,
      purchaseOrderNumber: asString(pick(record, ["customerPO", "purchaseOrderNumber", "poNumber", "po"])),
      customerName,
      storeNumber,
      locationName,
      address,
      city,
      state,
      zip,
      description,
      jobDetails: details,
      dneAmount: asMoney(pick(record, ["nTE", "nte", "dne", "dneAmount", "notToExceed"])),
      timeframe: asString(pick(record, ["timeframe", "workWindowBegin", "serviceWindow", "dueDate"])),
      dueDate: asString(pick(record, ["dueDate", "workWindowEnd"])),
      priority: asString(pick(record, ["priority"])),
      contactName: asString(pick(record, ["siteContactName", "contactName", "contact"])),
      contactPhone: asString(pick(record, ["siteContactPhone", "contactPhone", "phone"])),
      contactEmail: asString(pick(record, ["contactEmail", "email"])),
      tradeType: asString(pick(record, ["tradeType", "trade", "category"])),
    },
    details,
  });
}

function collectJobRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  for (const key of ["data", "results", "items", "jobs", "workOrders", "workorders", "tickets", "value", "records"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    const nested = asRecord(value);
    if (nested && Array.isArray(nested.data)) return nested.data;
    if (nested && Array.isArray(nested.results)) return nested.results;
  }
  if (record.workOrderNumber || record.workOrderId || record.number) return [record];
  return [];
}

export function mapPortalJsonToJobs(
  data: unknown,
  input: { source: "mhelpdesk" | "truesource" | "portal"; email: string }
): PortalJobDraft[] {
  return collectJobRows(data)
    .map((row, index) => portalRowToJob(row, { ...input, index }))
    .filter((row): row is PortalJobDraft => Boolean(row));
}

class CookieJar {
  private cookies = new Map<string, string>();

  absorb(response: Response) {
    const headers = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    const fallback = response.headers.get("set-cookie");
    const lines = headers.length ? headers : fallback ? [fallback] : [];
    for (const line of lines) {
      const pair = line.split(";")[0];
      const idx = pair.indexOf("=");
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

function hiddenInputs(html: string) {
  const fields = new Map<string, string>();
  const regex = /<input\b[^>]*>/gi;
  for (const match of html.match(regex) ?? []) {
    const name = match.match(/\bname=["']([^"']+)["']/i)?.[1];
    if (!name) continue;
    const value = match.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? "";
    fields.set(name, value.replace(/&amp;/g, "&"));
  }
  return fields;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHtmlTables(html: string, input: { source: "mhelpdesk" | "truesource"; email: string }): PortalJobDraft[] {
  const jobs: PortalJobDraft[] = [];
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    if (rows.length < 2) continue;
    const headers = (rows[0].match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map((cell) => decodeEntities(cell).toLowerCase());
    if (!headers.some((header) => /work\s*order|job|ticket|wo\s*#|store|customer/.test(header))) continue;
    for (const row of rows.slice(1)) {
      const cells = (row.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map((cell) => decodeEntities(cell));
      if (cells.filter(Boolean).length < 2) continue;
      const keyed: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (header) keyed[header] = cells[index] ?? "";
      });
      const mapped = portalRowToJob(
        {
          workOrderNumber: keyed["work order"] || keyed["work order #"] || keyed["wo #"] || keyed["job #"] || keyed["ticket"],
          customer: keyed.customer || keyed.account || keyed.client,
          storeNumber: keyed.store || keyed["store #"],
          location: keyed.location || keyed.site,
          description: keyed.description || keyed.issue || keyed.summary || keyed.job,
          status: keyed.status,
          city: keyed.city,
          state: keyed.state,
          nte: keyed.nte || keyed.dne,
        },
        { source: input.source, email: input.email, index: jobs.length }
      );
      if (mapped) jobs.push(mapped);
    }
  }
  return jobs;
}

function looksLikeLoginPage(html: string) {
  return /sign in to mhelpdesk|type your password|ucLogin_txtPassword|forgot password/i.test(html);
}

export async function tryFetchPortalJsonJobs(input: {
  baseUrl: string;
  email: string;
  password?: string;
  cookies?: string;
}): Promise<PortalJobDraft[] | null> {
  if (!input.baseUrl) return null;
  const endpoints = [
    "/api/workorders",
    "/api/v1/workorders",
    "/api/v1.0/WorkOrders",
    "/api/tickets",
    "/api/jobs",
    "/api/Jobs",
    "/WorkOrders",
    "/Jobs.aspx/GetJobs",
  ];
  for (const endpoint of endpoints) {
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (input.cookies) headers.cookie = input.cookies;
      if (input.password) {
        headers.authorization = `Basic ${Buffer.from(`${input.email}:${input.password}`).toString("base64")}`;
      }
      const response = await fetch(new URL(endpoint, `${input.baseUrl.replace(/\/$/, "")}/`).toString(), {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) continue;
      const data = (await response.json()) as unknown;
      const jobs = mapPortalJsonToJobs(data, { source: "portal", email: input.email });
      if (jobs.length) return jobs;
    } catch {
      continue;
    }
  }
  return null;
}

async function pullMhelpdeskHtmlSession(input: { baseUrl: string; email: string; password: string }): Promise<PortalPullResult> {
  const baseUrl = normalizeMhelpdeskBaseUrl(input.baseUrl);
  const jar = new CookieJar();
  const loginUrl = `${baseUrl}/SignIn.aspx`;
  const loginPage = await fetch(loginUrl, {
    headers: { accept: "text/html", "user-agent": "FortifiedCommandCenter/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  jar.absorb(loginPage);
  const html = await loginPage.text();
  const fields = hiddenInputs(html);
  fields.set("ucLogin$txtUsername", input.email);
  fields.set("ucLogin$txtPassword", input.password);
  fields.set("ucLogin$chkRemember", "on");
  if (!fields.has("ucLogin$cmdSubmit")) fields.set("ucLogin$cmdSubmit", "Sign in");
  fields.set("__EVENTTARGET", fields.get("__EVENTTARGET") || "ucLogin$cmdSubmit");

  const posted = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.header(),
      origin: baseUrl,
      referer: loginUrl,
      "user-agent": "FortifiedCommandCenter/1.0",
    },
    body: new URLSearchParams([...fields.entries()]),
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  jar.absorb(posted);
  const afterLogin = await posted.text();
  if (looksLikeLoginPage(afterLogin) || /recaptcha|verification code|invalid login|incorrect password/i.test(afterLogin)) {
    return {
      jobs: [],
      source: "none",
      warning:
        "mHelpDesk did not accept a dashboard login from this app (CAPTCHA or 2FA is likely required). Connect Gmail so assignment, bid, and quote emails import instead of sample jobs.",
    };
  }

  const jsonJobs = await tryFetchPortalJsonJobs({
    baseUrl,
    email: input.email,
    password: input.password,
    cookies: jar.header(),
  });
  if (jsonJobs?.length) return { jobs: jsonJobs, source: "api" };

  const htmlJobs: PortalJobDraft[] = [];
  for (const path of ["/Jobs.aspx", "/Dashboard.aspx", "/Calendar.aspx", "/Default.aspx"]) {
    try {
      const page = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: jar.header(), accept: "text/html", "user-agent": "FortifiedCommandCenter/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      });
      jar.absorb(page);
      const body = await page.text();
      if (looksLikeLoginPage(body)) continue;
      htmlJobs.push(...parseHtmlTables(body, { source: "mhelpdesk", email: input.email }));
    } catch {
      continue;
    }
  }
  if (htmlJobs.length) return { jobs: htmlJobs, source: "html" };
  return {
    jobs: [],
    source: "none",
    warning:
      "Logged into mHelpDesk, but no current work orders were listed on the jobs board. Gmail assignment mail will still import if Google is connected.",
  };
}

export async function pullMhelpdeskLiveJobs(input: {
  baseUrl: string;
  email: string;
  password?: string;
}): Promise<PortalPullResult> {
  if (!input.password) {
    return {
      jobs: [],
      source: "none",
      warning: "Save the mHelpDesk password to pull the live dashboard. Without it, only Gmail assignment emails can import.",
    };
  }
  const json = await tryFetchPortalJsonJobs(input);
  if (json?.length) return { jobs: json, source: "api" };
  try {
    return await pullMhelpdeskHtmlSession({ baseUrl: input.baseUrl, email: input.email, password: input.password });
  } catch (error) {
    return {
      jobs: [],
      source: "none",
      warning: error instanceof Error ? error.message : "mHelpDesk dashboard pull failed.",
    };
  }
}

async function truesourceGet(path: string, accessToken: string, params?: Record<string, string>) {
  const url = new URL(path, `${TRUESOURCE_API}/`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const record = asRecord(data);
    throw new Error(asString(record?.message) || asString(record?.title) || `Affiliate Connect ${path} failed (${response.status}).`);
  }
  return data;
}

function firstId(value: unknown): string | undefined {
  const rows = collectJobRows(value);
  for (const row of rows) {
    const record = asRecord(row);
    const id = asString(record?.id) || asString(record?.affiliateId) || asString(record?.vendorId);
    if (id) return id;
  }
  const record = asRecord(value);
  return asString(record?.id) || asString(record?.affiliateId) || asString(record?.currentAffiliateId);
}

export async function pullTruesourceLiveJobs(input: {
  email: string;
  password?: string;
}): Promise<PortalPullResult> {
  if (!input.password) {
    return {
      jobs: [],
      source: "none",
      warning:
        "Save the Affiliate Connect password to pull live TrueSource work orders. Without it, only Gmail dispatch/RFQ emails can import.",
    };
  }
  try {
    const tokens = await cognitoPasswordSignIn({
      region: TRUESOURCE_CONFIG.region,
      clientId: TRUESOURCE_CONFIG.clientId,
      userPoolId: TRUESOURCE_CONFIG.userPoolId,
      username: input.email,
      password: input.password,
      oauthDomain: TRUESOURCE_CONFIG.oauthDomain,
    });
    const token = tokens.accessToken || tokens.idToken;
    let affiliateId: string | undefined;
    try {
      affiliateId = firstId(await truesourceGet("/Affiliates", token));
    } catch {
      affiliateId = undefined;
    }

    const collected = new Map<string, PortalJobDraft>();
    const paramSets: Array<Record<string, string>> = [
      { pageNumber: "1", pageSize: "50", searchString: "" },
      { status: "All", pageNumber: "1", pageSize: "50" },
      { woStatus: "All", pageNumber: "1", pageSize: "50" },
    ];
    if (affiliateId) {
      paramSets.push({ affiliateId, pageNumber: "1", pageSize: "50", searchString: "" });
    }
    for (const status of ACTIVE_TRUESOURCE_STATUSES.slice(1, 8)) {
      paramSets.push({ status, pageNumber: "1", pageSize: "50", ...(affiliateId ? { affiliateId } : {}) });
    }

    for (const params of paramSets) {
      try {
        const data = await truesourceGet("/WorkOrders", token, params);
        for (const mapped of mapPortalJsonToJobs(data, { source: "truesource", email: input.email })) {
          collected.set(mapped.sourceRef, mapped);
        }
        if (collected.size >= 8) break;
      } catch {
        continue;
      }
    }

    if (collected.size) return { jobs: [...collected.values()], source: "api" };

    try {
      const quotes = await truesourceGet("/Quotes", token, { pageNumber: "1", pageSize: "50" });
      for (const mapped of mapPortalJsonToJobs(quotes, { source: "truesource", email: input.email })) {
        collected.set(mapped.sourceRef, mapped);
      }
    } catch {
      /* Quotes list is optional */
    }
    if (collected.size) return { jobs: [...collected.values()], source: "api" };

    return {
      jobs: [],
      source: "api",
      warning: "Logged into Affiliate Connect, but the current board did not return open work orders or quotes.",
    };
  } catch (error) {
    return {
      jobs: [],
      source: "none",
      warning:
        error instanceof Error
          ? `Affiliate Connect login failed: ${error.message} Connect Gmail so TrueSource assignment and RFQ emails still import.`
          : "Affiliate Connect login failed.",
    };
  }
}
