import { normalizeStateCode } from "../../src/lib/subcontractors/geo.ts";

export type ContractorCandidate = {
  id: string;
  companyName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  serviceStates: string[];
  trades: string[];
  preferred: boolean;
  status: string;
};

export type DispatchRoute = {
  id: string;
  label: string;
  states: string[];
  cities: string[];
  zipPrefixes: string[];
  trades: string[];
  subcontractorId: string;
  active: boolean;
};

export type JobLocation = {
  city?: string;
  state?: string;
  zip?: string;
  tradeType?: string;
};

export type ContractorMatch = {
  contractor: ContractorCandidate;
  reason: string;
  routeId?: string;
};

function list(values?: string[] | string | null) {
  if (Array.isArray(values)) return values.map((value) => String(value).trim()).filter(Boolean);
  if (typeof values === "string") return values.split(",").map((value) => value.trim()).filter(Boolean);
  return [];
}

export function normalizeTrade(value?: string | null) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function tradesOverlap(jobTrade: string | undefined, trades: string[]) {
  const needle = normalizeTrade(jobTrade);
  if (!needle || !trades.length) return false;
  return trades.some((trade) => {
    const haystack = normalizeTrade(trade);
    return Boolean(haystack) && (haystack.includes(needle) || needle.includes(haystack));
  });
}

function samePlace(a?: string, b?: string) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function activeContractor(contractor: ContractorCandidate) {
  return contractor.status.trim().toLowerCase() === "active" && Boolean(contractor.id);
}

export function routeApplies(route: DispatchRoute, job: JobLocation) {
  if (!route.active) return false;
  const states = route.states.map((state) => normalizeStateCode(state)).filter(Boolean);
  const cities = route.cities.map((city) => city.trim().toLowerCase()).filter(Boolean);
  const zips = route.zipPrefixes.map((zip) => zip.trim()).filter(Boolean);
  const trades = route.trades.filter(Boolean);
  if (!states.length && !cities.length && !zips.length) return false;

  const jobState = normalizeStateCode(job.state);
  const jobCity = job.city?.trim().toLowerCase() || "";
  const jobZip = job.zip?.trim() || "";

  if (states.length && !states.includes(jobState)) return false;
  if (cities.length && !cities.includes(jobCity)) return false;
  if (zips.length && !zips.some((prefix) => jobZip.startsWith(prefix))) return false;
  if (trades.length && !tradesOverlap(job.tradeType, trades)) return false;
  return true;
}

export function matchContractor(
  job: JobLocation,
  routes: DispatchRoute[],
  contractors: ContractorCandidate[]
): ContractorMatch | null {
  const byId = new Map(contractors.filter(activeContractor).map((contractor) => [contractor.id, contractor]));
  const jobState = normalizeStateCode(job.state);
  const jobCity = job.city?.trim() || "";

  let bestRoute: { route: DispatchRoute; contractor: ContractorCandidate; score: number } | null = null;
  for (const route of routes) {
    if (!routeApplies(route, job)) continue;
    const contractor = byId.get(route.subcontractorId);
    if (!contractor) continue;
    let score = 10;
    if (route.cities.length) score += 30;
    if (route.zipPrefixes.length) score += 20;
    if (route.trades.length) score += 15;
    if (contractor.preferred) score += 5;
    if (!bestRoute || score > bestRoute.score) bestRoute = { route, contractor, score };
  }

  if (bestRoute) {
    const where = [jobCity, jobState].filter(Boolean).join(", ") || "this location";
    return {
      contractor: bestRoute.contractor,
      routeId: bestRoute.route.id,
      reason: `Predetermined route “${bestRoute.route.label}” covers ${where}.`,
    };
  }

  let best: { contractor: ContractorCandidate; score: number } | null = null;
  for (const contractor of byId.values()) {
    const states = contractor.serviceStates.map((state) => normalizeStateCode(state)).filter(Boolean);
    const homeState = normalizeStateCode(contractor.state);
    const coversState = jobState && (states.includes(jobState) || (!states.length && homeState === jobState));
    if (!coversState) continue;
    let score = 10;
    if (contractor.preferred) score += 40;
    if (tradesOverlap(job.tradeType, contractor.trades)) score += 25;
    if (samePlace(contractor.city, job.city)) score += 20;
    if (states.includes(jobState)) score += 10;
    if (!best || score > best.score || (score === best.score && contractor.companyName.localeCompare(best.contractor.companyName) < 0)) {
      best = { contractor, score };
    }
  }

  if (!best) return null;
  const where = [jobCity, jobState].filter(Boolean).join(", ") || jobState;
  const tradeNote = tradesOverlap(job.tradeType, best.contractor.trades) ? ` ${job.tradeType} coverage matches.` : "";
  return {
    contractor: best.contractor,
    reason: `${best.contractor.companyName} is the predetermined ${best.contractor.preferred ? "preferred " : ""}crew for ${where}.${tradeNote}`,
  };
}

export function toContractorCandidate(row: Record<string, unknown>): ContractorCandidate {
  return {
    id: String(row.id ?? ""),
    companyName: String(row.company_name ?? row.companyName ?? "Contractor"),
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    serviceStates: list((row.service_states ?? row.serviceStates) as string[] | string | null),
    trades: list((row.trades ?? row.trade_types) as string[] | string | null),
    preferred: Boolean(row.preferred_vendor ?? row.preferred ?? row.is_preferred),
    status: String(row.status ?? "active"),
  };
}
