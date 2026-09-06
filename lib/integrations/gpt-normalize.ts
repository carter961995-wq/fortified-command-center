export function cleanText(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

export function cleanList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,|\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [] as string[];
}

export function matchKey(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function namesMatch(a: unknown, b: unknown) {
  const left = matchKey(a);
  const right = matchKey(b);
  return Boolean(left && right && left === right);
}

const STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  arkansas: "AR",
  georgia: "GA",
  kansas: "KS",
  louisiana: "LA",
  mississippi: "MS",
  missouri: "MO",
  tennessee: "TN",
  texas: "TX",
};

export function normalizeState(value: unknown) {
  const text = cleanText(value);
  if (!text) return "";
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();
  return STATE_NAMES[text.toLowerCase()] ?? text.toUpperCase().slice(0, 2);
}

export function normalizeCustomerType(value: unknown) {
  const text = matchKey(value);
  if (text.includes("retail") || text.includes("home depot") || text.includes("lowes")) return "retail";
  if (text.includes("property")) return "property_manager";
  if (text.includes("facilit")) return "facilities_network";
  if (text.includes("school") || text.includes("district")) return "school";
  if (text.includes("government") || text.includes("city") || text.includes("parish")) return "government";
  if (text.includes("resident")) return "residential";
  if (text.includes("commercial") || text.includes("warehouse") || text.includes("industrial")) return "commercial";
  return "commercial";
}

export function normalizeCustomerStatus(value: unknown) {
  const text = matchKey(value);
  if (text.includes("inactive") || text.includes("closed")) return "inactive";
  if (text.includes("prospect") || text.includes("lead")) return "prospect";
  return "active";
}

export function normalizeSubStatus(value: unknown) {
  const text = matchKey(value);
  if (text.includes("block")) return "blocked";
  if (text.includes("probation") || text.includes("watch")) return "probation";
  if (text.includes("inactive") || text.includes("archive")) return "inactive";
  return "active";
}

export function normalizePriority(value: unknown) {
  const text = matchKey(value);
  if (text.includes("emerg") || text.includes("critical")) return "emergency";
  if (text.includes("urgent") || text.includes("high") || text.includes("asap")) return "urgent";
  if (text.includes("low")) return "low";
  return "normal";
}

export function normalizeWorkOrderStatus(value: unknown) {
  const text = matchKey(value);
  const table: Array<[string, string]> = [
    ["cancel", "Cancelled"],
    ["callback", "Callback/Warranty"],
    ["warranty", "Callback/Warranty"],
    ["paid", "Paid"],
    ["invoiced", "Invoiced"],
    ["ready to invoice", "Ready to Invoice"],
    ["review", "Needs Review"],
    ["completed", "Completed by Sub"],
    ["in progress", "In Progress"],
    ["progress", "In Progress"],
    ["scheduled", "Scheduled"],
    ["approved", "Approved"],
    ["quote sent", "Quote Sent"],
    ["waiting on sub", "Waiting on Sub Quote"],
    ["quote needed", "Quote Needed"],
    ["site info", "Needs Site Info"],
    ["closed", "Closed"],
    ["new", "New"],
  ];
  for (const [needle, status] of table) {
    if (text.includes(needle)) return status;
  }
  return "New";
}

export function normalizeSource(value: unknown) {
  const text = matchKey(value);
  if (text.includes("home depot")) return "Home Depot";
  if (text.includes("agm")) return "AGM";
  if (text.includes("facilit")) return "facilities_network";
  if (text.includes("website") || text.includes("web")) return "website";
  if (text.includes("phone") || text.includes("call")) return "phone";
  if (text.includes("refer")) return "referral";
  if (text.includes("direct")) return "direct";
  return "other";
}

export function asMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

export function asDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
