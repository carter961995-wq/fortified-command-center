import test from "node:test";
import assert from "node:assert/strict";
import { crewPerformanceForTrade, rankReviewedCrewEvidence, summarizeCrewMapPerformance, type ReviewedRankingJob } from "../lib/subcontractor-map-performance.ts";

const job = {
  id: "job-1", subcontractor_id: "crew-1", work_order_number: "WO-1", status: "Closed",
  trade_type: "Fence", completed_date: "2026-10-02", due_date: "2026-10-02",
};
const cost = {
  id: "cost-1", work_order_id: "job-1", subcontractor_id: "crew-1",
  cost_type: "subcontractor", paid: true, receipt_url: "private-receipt", amount: "450.59",
};

test("counts dated post-review completions once and does not treat a callback as successful completion", () => {
  const list = summarizeCrewMapPerformance([
    job, job, { ...job, id: "job-2", status: "Completed by Sub" },
    { ...job, id: "job-3", status: "Callback/Warranty" }, { ...job, id: "job-4", completed_date: "2026-02-30" },
    { ...job, id: "job-5", subcontractor_id: null }, { ...job, id: "job-6", status: "Cancelled" },
    { ...job, id: "job-7", status: "Ready to Invoice", due_date: "2026-10-01" },
    { ...job, id: "job-8", due_date: null },
  ], []);
  const evidence = list["crew-1"].all;
  assert.equal(evidence.completedCount, 3);
  assert.equal(evidence.datedCount, 2);
  assert.equal(evidence.byRecordedDueDateCount, 1);
  assert.equal(evidence.receiptedPaidCostCount, 0);
});

test("links receipted paid entries to both completed work order and identical crew; never shares receipt URL", () => {
  const list = summarizeCrewMapPerformance([{ ...job, not_to_exceed_amount: 2000 }], [
    cost, cost, { ...cost, id: "cost-2", amount: 49.41 },
    { ...cost, id: "cost-3", work_order_id: "job-2" },
    { ...cost, id: "cost-4", subcontractor_id: "crew-2" },
    { ...cost, id: "cost-5", paid: false },
    { ...cost, id: "cost-6", receipt_url: "" },
    { ...cost, id: "cost-7", cost_type: "materials" },
    { ...cost, id: "cost-8", amount: false },
  ]);
  assert.equal(list["crew-1"].all.recentJobs[0].recordedSubCost, 500);
  assert.equal(list["crew-1"].all.receiptedPaidCostCount, 1);
  assert.doesNotMatch(JSON.stringify(list), /private-receipt|2000/);
});

test("shows only exact recorded trade history when checking a focused trade and does not treat unknown as a match", () => {
  const list = summarizeCrewMapPerformance([job, { ...job, id: "job-2", trade_type: null }, { ...job, id: "job-3", trade_type: "Welding" }], []);
  assert.equal(crewPerformanceForTrade(list, "crew-1", " fence ")?.completedCount, 1);
  assert.equal(crewPerformanceForTrade(list, "crew-1", null)?.completedCount, 3);
  assert.equal(crewPerformanceForTrade(list, "crew-1", "gate"), null);
  assert.equal(crewPerformanceForTrade(list, "unlinked", "fence"), null);
});

test("limits recent example links but keeps the complete tracked denominator", () => {
  const list = summarizeCrewMapPerformance(Array.from({ length: 7 }, (_, index) => ({ ...job, id: `job-${index}`, completed_date: `2026-10-0${index + 1}` })), []);
  assert.equal(list["crew-1"].all.completedCount, 7);
  assert.equal(list["crew-1"].all.recentJobs.length, 5);
  assert.equal(list["crew-1"].all.recentJobs[0].completedDate, "2026-10-07");
});

const reviewed = (crewId: string, index: number, overrides: Partial<ReviewedRankingJob> = {}): ReviewedRankingJob => ({
  workOrderId: crewId + index,
  crewId, trade: "Fence", comparableScopeKey: "trade-and-scope",
  completionRef: "document:completion", approvedCrewTermsRef: "document:terms",
  finalPaidCostRef: "document:final", qualityReviewRef: "document:quality",
  approvedCrewCents: 40_000, finalPaidCrewCents: 39_500,
  agreedDueDate: "2026-10-02", completedDate: "2026-10-02", qualityOutcome: "first-pass",
  ...overrides,
});

test("ranking requires three unique explicitly reviewed jobs per crew and at least two crews", () => {
  const first = [1, 2, 3].map((i) => reviewed("crew-a", i));
  const incomplete = [
    reviewed("crew-b", 1),
    reviewed("crew-b", 2, { qualityReviewRef: "" }),
    reviewed("crew-b", 3, { approvedCrewTermsRef: "" }),
    reviewed("crew-b", 4, { comparableScopeKey: "unrelated" }),
    reviewed("crew-b", 5, { trade: "Welding" }),
    reviewed("crew-b", 6, { finalPaidCrewCents: 0 }),
    reviewed("crew-b", 7, { agreedDueDate: "2026-11-31" }),
    reviewed("crew-b", 8), reviewed("crew-b", 8, { finalPaidCrewCents: 45_000 }),
  ];
  assert.equal(rankReviewedCrewEvidence([...first, ...incomplete], "fence", "trade-and-scope"), null);
  assert.equal(rankReviewedCrewEvidence(first, "fence", ""), null);
});

test("ranked tiers preserve trade-offs and leave insufficient samples unranked", () => {
  const jobs = [
    ...[1, 2, 3].map((i) => reviewed("fast", i, { qualityOutcome: "rework-required" })),
    ...[1, 2, 3, 4].map((i) => reviewed("clean", i, { completedDate: "2026-10-03" })),
    ...[1, 2, 3].map((i) => reviewed("below", i, { completedDate: "2026-10-03", qualityOutcome: "rework-required", finalPaidCrewCents: 42_000 })),
    reviewed("new", 1),
  ];
  const ranked = rankReviewedCrewEvidence(jobs, "FENCE", "trade-and-scope");
  assert.deepEqual(ranked?.tiers.map((tier) => tier.map((entry) => entry.crewId)), [["clean", "fast"], ["below"]]);
  assert.deepEqual(ranked?.tiers[0][0], { crewId: "clean", count: 4, firstPass: 4, onTime: 0, withinAgreedPrice: 4 });
  assert.deepEqual(ranked?.unranked.map((entry) => entry.crewId), ["new"]);
});
