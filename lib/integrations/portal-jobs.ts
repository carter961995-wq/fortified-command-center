import type { ParsedJobFields } from "./job-intake";

export type PortalJobDraft = {
  sourceRef: string;
  subject: string;
  from: string;
  snippet: string;
  rawText: string;
  parsed: ParsedJobFields;
};

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

export async function tryFetchPortalJsonJobs(input: {
  baseUrl: string;
  email: string;
  password?: string;
}): Promise<PortalJobDraft[] | null> {
  if (!input.password || !input.baseUrl) return null;
  const endpoints = ["/api/workorders", "/api/v1/workorders", "/api/tickets", "/api/jobs"];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(new URL(endpoint, `${input.baseUrl.replace(/\/$/, "")}/`).toString(), {
        headers: {
          accept: "application/json",
          authorization: `Basic ${Buffer.from(`${input.email}:${input.password}`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as unknown;
      const rows = Array.isArray(data) ? data : Array.isArray((data as { jobs?: unknown[] }).jobs)
        ? (data as { jobs: unknown[] }).jobs
        : Array.isArray((data as { workOrders?: unknown[] }).workOrders)
          ? (data as { workOrders: unknown[] }).workOrders
          : [];
      if (!rows.length) continue;
      return rows.slice(0, 40).map((row, index) => {
        const record = (row ?? {}) as Record<string, unknown>;
        const workOrderNumber = String(record.workOrderNumber ?? record.number ?? record.id ?? `PORTAL-${index + 1}`);
        const description = String(record.description ?? record.title ?? record.summary ?? "Portal work order");
        return job({
          sourceRef: `portal-${workOrderNumber}`,
          subject: String(record.subject ?? `Work order ${workOrderNumber}`),
          from: input.email,
          parsed: {
            workOrderNumber,
            customerName: record.customer ? String(record.customer) : undefined,
            storeNumber: record.storeNumber ? String(record.storeNumber) : undefined,
            locationName: record.location ? String(record.location) : undefined,
            description,
            dneAmount: typeof record.dne === "number" ? record.dne : null,
            priority: record.priority ? String(record.priority) : undefined,
          },
          details: String(record.details ?? record.notes ?? description),
        });
      });
    } catch {
      continue;
    }
  }
  return null;
}
