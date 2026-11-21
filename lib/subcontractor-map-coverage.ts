export type CoveragePoint = { lat: number; lng: number; hasRecordedCoordinates: boolean };
export type CrewCoverage = CoveragePoint & {
  state: string;
  serviceStates: readonly string[];
  serviceRadius: number | null;
  status: string;
};
export type JobCoverage = CoveragePoint & { state: string };

export function hasRecordedMapCoordinates(lat: unknown, lng: unknown): boolean {
  const numeric = (value: unknown): value is number | string =>
    typeof value === "number" || (typeof value === "string" && value.trim() !== "");
  if (!numeric(lat) || !numeric(lng)) return false;
  const x = Number(lat);
  const y = Number(lng);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 90 && Math.abs(y) <= 180 && (x !== 0 || y !== 0);
}

export function recordedServiceRadius(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const radius = Number(value);
  return Number.isFinite(radius) && radius > 0 ? radius : null;
}

export function isActiveMapCrew(status: string): boolean {
  return status.trim().toLowerCase() === "active";
}

export function coverageMatch(crew: CrewCoverage, job: JobCoverage): "listed-state" | "same-state-radius" | null {
  const state = job.state.trim().toUpperCase();
  if (!state || !isActiveMapCrew(crew.status)) return null;
  if (crew.serviceStates.some((entry) => entry.trim().toUpperCase() === state)) return "listed-state";

  if (crew.state.trim().toUpperCase() !== state || crew.serviceRadius === null ||
      !crew.hasRecordedCoordinates || !job.hasRecordedCoordinates) return null;
  const rad = Math.PI / 180;
  const dLat = (job.lat - crew.lat) * rad;
  const dLng = (job.lng - crew.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(crew.lat * rad) * Math.cos(job.lat * rad) * Math.sin(dLng / 2) ** 2;
  const miles = 2 * 3958.8 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  return miles <= crew.serviceRadius ? "same-state-radius" : null;
}

export function matchesTradeFilter(trades: readonly string[], filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  return !needle || trades.some((trade) => trade.trim().toLowerCase() === needle);
}
