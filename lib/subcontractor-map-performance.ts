import { isCalendarDate, type PlainRow } from "./business.ts";

const REVIEWED_COMPLETION = new Set(["Ready to Invoice", "Invoiced", "Paid", "Closed"]);
const RECENT_JOBS = 5;

export type WorkOrderEvidence = {
  id: string;
  number: string;
  completedDate: string;
  dueDate: string | null;
  recordedSubCost: number | null;
};

export type CrewPerformanceEvidence = {
  completedCount: number;
  datedCount: number;
  byRecordedDueDateCount: number;
  receiptedPaidCostCount: number;
  recentJobs: WorkOrderEvidence[];
};

export type CrewMapPerformance = Record<string, { all: CrewPerformanceEvidence; byTrade: Record<string, CrewPerformanceEvidence> }>;
type EvidenceBucket = CrewPerformanceEvidence & { recentJobs: WorkOrderEvidence[] };

export function normalizedEvidenceTrade(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function asDate(value: unknown) {
  return typeof value === "string" && isCalendarDate(value) ? value : null;
}

function asId(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function emptyBucket(): EvidenceBucket {
  return { completedCount: 0, datedCount: 0, byRecordedDueDateCount: 0, receiptedPaidCostCount: 0, recentJobs: [] };
}

function addEvidence(bucket: EvidenceBucket, job: WorkOrderEvidence) {
  bucket.completedCount += 1;
  if (job.dueDate !== null) {
    bucket.datedCount += 1;
    if (job.completedDate <= job.dueDate) bucket.byRecordedDueDateCount += 1;
  }
  if (job.recordedSubCost !== null) bucket.receiptedPaidCostCount += 1;
  if (bucket.recentJobs.length < RECENT_JOBS) bucket.recentJobs.push(job);
}

export function summarizeCrewMapPerformance(jobs: PlainRow[], costs: PlainRow[]): CrewMapPerformance {
  const linkedJobs = new Map<string, { subcontractorId: string; trade: string; evidence: WorkOrderEvidence }>();
  for (const row of jobs) {
    const id = asId(row.id);
    const subcontractorId = asId(row.subcontractor_id);
    const completedDate = asDate(row.completed_date);
    if (!id || !subcontractorId || !completedDate || !REVIEWED_COMPLETION.has(String(row.status)) || linkedJobs.has(id)) continue;
    linkedJobs.set(id, { subcontractorId, trade: normalizedEvidenceTrade(row.trade_type), evidence: {
      id, number: asId(row.work_order_number) || "Open work order", completedDate,
      dueDate: asDate(row.due_date), recordedSubCost: null,
    } });
  }

  const seenCosts = new Set<string>();
  for (const row of costs) {
    const id = asId(row.id);
    const linked = linkedJobs.get(asId(row.work_order_id));
    if (!id || seenCosts.has(id) || !linked || linked.subcontractorId !== asId(row.subcontractor_id)) continue;
    if (row.cost_type !== "subcontractor" || row.paid !== true || !asId(row.receipt_url)) continue;
    if (typeof row.amount !== "number" && typeof row.amount !== "string") continue;
    const cents = Math.round(Number(row.amount) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) continue;
    seenCosts.add(id);
    linked.evidence.recordedSubCost = (Math.round((linked.evidence.recordedSubCost ?? 0) * 100) + cents) / 100;
  }

  const results = new Map<string, { all: EvidenceBucket; trades: Map<string, EvidenceBucket> }>();
  for (const row of [...linkedJobs.values()].sort((a, b) => b.evidence.completedDate.localeCompare(a.evidence.completedDate) || a.evidence.id.localeCompare(b.evidence.id))) {
    let crew = results.get(row.subcontractorId);
    if (!crew) {
      crew = { all: emptyBucket(), trades: new Map() };
      results.set(row.subcontractorId, crew);
    }
    addEvidence(crew.all, row.evidence);
    if (!row.trade) continue;
    const bucket = crew.trades.get(row.trade) ?? emptyBucket();
    addEvidence(bucket, row.evidence);
    crew.trades.set(row.trade, bucket);
  }

  return Object.fromEntries([...results].map(([id, entry]) => [id, { all: entry.all, byTrade: Object.fromEntries(entry.trades) }]));
}

export function crewPerformanceForTrade(performance: CrewMapPerformance, crewId: string, involvedTrade: unknown) {
  if (!Object.hasOwn(performance, crewId)) return null;
  const crew = performance[crewId];
  const trade = normalizedEvidenceTrade(involvedTrade);
  return trade ? (Object.hasOwn(crew.byTrade, trade) ? crew.byTrade[trade] : null) : crew.all;
}

export type ReviewedRankingJob = {
  workOrderId: string;
  crewId: string;
  trade: string;
  comparableScopeKey: string;
  completionRef: string;
  approvedCrewTermsRef: string;
  finalPaidCostRef: string;
  qualityReviewRef: string;
  approvedCrewCents: number;
  finalPaidCrewCents: number;
  agreedDueDate: string;
  completedDate: string;
  qualityOutcome: "first-pass" | "rework-required";
};

export const minimumComparableJobs = 3;

function reviewedRankingJob(row: ReviewedRankingJob, trade: string, group: string) {
  return Boolean(
    asId(row.workOrderId) && asId(row.crewId) && normalizedEvidenceTrade(row.trade) === trade &&
    asId(row.comparableScopeKey).trim() === group &&
    asId(row.completionRef) && asId(row.approvedCrewTermsRef) && asId(row.finalPaidCostRef) && asId(row.qualityReviewRef) &&
    asDate(row.agreedDueDate) && asDate(row.completedDate) &&
    Number.isSafeInteger(row.approvedCrewCents) && row.approvedCrewCents > 0 &&
    Number.isSafeInteger(row.finalPaidCrewCents) && row.finalPaidCrewCents > 0 &&
    (row.qualityOutcome === "first-pass" || row.qualityOutcome === "rework-required")
  );
}

type CrewMetrics = { crewId: string; count: number; firstPass: number; onTime: number; withinAgreedPrice: number };

// Future reviewed source only. Neither customer NTE nor a generic callback/quality score
// can establish these inputs. Scope key identifies a staff-reviewed common scope/market.
export function rankReviewedCrewEvidence(rows: ReviewedRankingJob[], trade: string, comparableScopeKey: string) {
  const normalizedTrade = normalizedEvidenceTrade(trade);
  const group = comparableScopeKey.trim();
  if (!normalizedTrade || !group) return null;

  const valid = rows.filter((row) => reviewedRankingJob(row, normalizedTrade, group));
  const occurrences = new Map<string, number>();
  for (const row of valid) occurrences.set(row.workOrderId, (occurrences.get(row.workOrderId) ?? 0) + 1);
  const crews = new Map<string, CrewMetrics>();
  for (const row of valid) {
    // Do not arbitrarily interpret duplicate/conflicting reviews.
    if (occurrences.get(row.workOrderId) !== 1) continue;
    const metrics = crews.get(row.crewId) ?? { crewId: row.crewId, count: 0, firstPass: 0, onTime: 0, withinAgreedPrice: 0 };
    metrics.count += 1;
    metrics.firstPass += Number(row.qualityOutcome === "first-pass");
    metrics.onTime += Number(row.completedDate <= row.agreedDueDate);
    metrics.withinAgreedPrice += Number(row.finalPaidCrewCents <= row.approvedCrewCents);
    crews.set(row.crewId, metrics);
  }

  let remaining = [...crews.values()].filter((crew) => crew.count >= minimumComparableJobs);
  if (remaining.length < 2) return null;
  const unranked = [...crews.values()].filter((crew) => crew.count < minimumComparableJobs).sort((a, b) => a.crewId.localeCompare(b.crewId));
  const metricKeys = ["firstPass", "onTime", "withinAgreedPrice"] as const;
  const dominates = (a: CrewMetrics, b: CrewMetrics) => {
    const ratios = metricKeys.map((key) => a[key] * b.count - b[key] * a.count);
    return ratios.every((difference) => difference >= 0) && ratios.some((difference) => difference > 0);
  };
  const tiers: CrewMetrics[][] = [];
  while (remaining.length) {
    // No weighting: a crew outranks another only if no tracked rate is worse and one is better.
    // Equal rates and quality/time/price trade-offs do not produce an invented winner.
    const tier = remaining.filter((crew) => !remaining.some((other) => dominates(other, crew))).sort((a, b) => a.crewId.localeCompare(b.crewId));
    tiers.push(tier);
    remaining = remaining.filter((crew) => !tier.includes(crew));
  }
  return { tiers, unranked };
}
