"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, MapPin, Plus, Radar, Search, Satellite } from "lucide-react";
import { approveWorkOrderDispatch, assignWorkOrderSubcontractor } from "../lib/actions";
import { formatDate, money } from "../lib/business";
import { crewPerformanceForTrade, type CrewMapPerformance } from "../lib/subcontractor-map-performance";
import { coverageMatch, isActiveMapCrew, matchesTradeFilter } from "../lib/subcontractor-map-coverage";
import type { SubcontractorMapPin, WorkOrderMapPin } from "../lib/subcontractor-pins";

const LeafletMap = dynamic(() => import("./subcontractor-map-leaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[560px] items-center justify-center bg-[#d7e3ea] text-sm font-bold text-slate-600">
      <Loader2 className="mr-2 size-4 animate-spin" />
      Loading street map...
    </div>
  ),
});

export function SubcontractorMapPanel({
  subcontractors,
  workOrders,
  performance,
  costsAvailable,
  historyAvailable,
}: {
  subcontractors: SubcontractorMapPin[];
  workOrders: WorkOrderMapPin[];
  performance: CrewMapPerformance;
  costsAvailable: boolean;
  historyAvailable: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [focusJobId, setFocusJobId] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [satellite, setSatellite] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [reviewJobId, setReviewJobId] = useState<string | null>(null);

  const openJobs = useMemo(
    () => workOrders.filter((job) => !["Closed", "Cancelled", "Paid"].includes(job.status)),
    [workOrders]
  );
  const focusJob = openJobs.find((job) => job.id === focusJobId);
  const visibleJobs = useMemo(() => focusJob ? [focusJob] : openJobs, [focusJob, openJobs]);
  const trades = useMemo(() => [...new Set(subcontractors.flatMap((pin) => pin.trades.map((trade) => trade.toLowerCase())))].sort(), [subcontractors]);
  const statuses = useMemo(() => [...new Set(subcontractors.map((pin) => pin.status))].sort(), [subcontractors]);
  const coverage = useMemo(() => new Map(subcontractors.map((pin) => [
    pin.id,
    focusJob ? coverageMatch({ ...pin, state: pin.recordedState }, { ...focusJob, state: focusJob.recordedState }) : null,
  ])), [focusJob, subcontractors]);

  const visibleSubs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return subcontractors.filter((pin) => (
      (!focusJob || coverage.get(pin.id) !== null) &&
      matchesTradeFilter(pin.trades, tradeFilter) &&
      (!statusFilter || pin.status === statusFilter) &&
      (!needle || [pin.companyName, pin.city, pin.state, pin.contactName, pin.trades.join(" "), pin.serviceStates.join(" ")]
        .join(" ").toLowerCase().includes(needle))
    )).sort((a, b) => a.companyName.localeCompare(b.companyName) || a.id.localeCompare(b.id));
  }, [coverage, focusJob, query, statusFilter, subcontractors, tradeFilter]);

  const selected = visibleSubs.find((pin) => pin.id === selectedId);
  const evidenceTrade = focusJob?.trade.trim() || tradeFilter;
  const selectedEvidence = selected ? crewPerformanceForTrade(performance, selected.id, evidenceTrade) : null;
  const unassignedJobs = visibleJobs.filter((job) => !job.subcontractorId);
  const reviewJob = unassignedJobs.find((job) => job.id === reviewJobId) ?? null;

  function chooseJob(id: string) {
    setFocusJobId(id);
    setSelectedId(undefined);
    setReviewJobId(null);
    setStatusFilter("");
    setDispatchMessage(null);
  }

  function chooseCrew(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setReviewJobId(null);
    setDispatchMessage(null);
  }

  async function confirmDispatch() {
    if (!selected || !reviewJob || dispatchingId || !isActiveMapCrew(selected.status)) return;
    const workOrderId = reviewJob.id;
    setDispatchingId(workOrderId);
    setDispatchMessage(null);
    try {
      const approved = await approveWorkOrderDispatch(workOrderId, selected.id);
      if (approved.error || !approved.approvalId) {
        setDispatchMessage(approved.error ?? "Logan must approve this dispatch before it is sent.");
        return;
      }
      const result = await assignWorkOrderSubcontractor(workOrderId, selected.id, approved.approvalId);
      setDispatchMessage(result.error ?? `Dispatched ${selected.companyName} after review.`);
      if (!result.error) {
        setReviewJobId(null);
        router.refresh();
      }
    } catch (error) {
      setDispatchMessage(error instanceof Error ? error.message : "Dispatch failed.");
    } finally {
      setDispatchingId(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-xl border border-[#1f304d] bg-[#111f38]">
        <div className="border-b border-[#1f304d] p-4">
          <label className="flex items-center gap-2 rounded-lg border border-[#223758] bg-[#0c172b] px-3 py-2 text-slate-300">
            <Search className="size-4 shrink-0 text-slate-500" />
            <input
              aria-label="Search crews"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search crews, cities, specialty..."
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <div className="mt-3 grid gap-2">
            <label className="text-xs font-bold text-slate-300">
              Find crews for a job
              <select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2 text-white" value={focusJobId} disabled={!!dispatchingId} onChange={(event) => chooseJob(event.target.value)}>
                <option value="">All open jobs</option>
                {openJobs.map((job) => <option key={job.id} value={job.id}>{job.number ? `${job.number} · ` : ""}{job.title}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-bold text-slate-300">Trade
                <select className="mt-1 w-full min-w-0 rounded border border-slate-600 bg-slate-900 p-2 text-white" value={tradeFilter} onChange={(event) => { setTradeFilter(event.target.value); setReviewJobId(null); }}>
                  <option value="">All trades</option>
                  {trades.map((trade) => <option key={trade}>{trade}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-300">Status
                <select className="mt-1 w-full min-w-0 rounded border border-slate-600 bg-slate-900 p-2 text-white" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setReviewJobId(null); }}>
                  <option value="">All statuses</option>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
          </div>
          {focusJob ? (
            <div className="mt-3 rounded-lg border border-violet-400/60 p-2 text-xs text-slate-200">
              <Link href={focusJob.href} className="font-bold text-violet-200 underline">{focusJob.title}</Link>
              <p>Coverage only. Select a crew to see documented past work. Dispatch still requires approval.</p>
            </div>
          ) : null}
          <p aria-live="polite" className="mt-3 text-xs font-bold text-slate-400">
            {visibleSubs.length} of {subcontractors.length} crews · {visibleJobs.length} open jobs shown
          </p>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {visibleSubs.map((pin) => (
            <button
              type="button"
              key={pin.id}
              disabled={!!dispatchingId}
              onClick={() => chooseCrew(pin.id)}
              className={`block w-full border-b border-[#1f304d] p-4 text-left hover:bg-[#172844] ${
                selectedId === pin.id ? "bg-[#172844]" : ""
              }`}
            >
              <div className="flex gap-3">
                <span
                  className="mt-1 size-3 rounded-full"
                  style={{ backgroundColor: isActiveMapCrew(pin.status) ? "#34d399" : pin.status === "blocked" ? "#ef4444" : "#f59e0b" }}
                />
                <div>
                  <p className="font-black text-white">{pin.companyName}</p>
                  <p className="text-xs font-semibold text-slate-400">
                    {pin.city}, {pin.state}{pin.serviceRadius !== null ? ` · ${pin.serviceRadius} mi listed radius` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{pin.trades.join(", ") || "Trades unverified"} · {pin.status}</p>
                  {historyAvailable ? <p className="mt-1 text-xs text-slate-400">{crewPerformanceForTrade(performance, pin.id, evidenceTrade)?.completedCount ?? 0} documented completions · Unranked</p> : null}
                  {focusJob ? <p className="mt-1 text-xs text-violet-200">{coverage.get(pin.id) === "listed-state" ? "Listed service state" : "Within listed same-state radius"}</p> : null}
                </div>
              </div>
            </button>
          ))}
          {visibleSubs.length === 0 ? (
            <p className="p-4 text-sm font-semibold text-slate-400">No crews match the current filters and documented coverage.</p>
          ) : null}
        </div>
      </aside>

      <section className="overflow-hidden rounded-xl border border-[#1f304d] bg-[#d7e3ea]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f304d] bg-[#111f38] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-200">
              <span className="size-2 rounded-full bg-emerald-400" /> Crews
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-1 text-orange-200">
              <span className="size-2 rounded-full bg-orange-400" /> Open jobs
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-1 text-sky-200">
              <Radar className="size-3" /> Coverage rings
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSatellite((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:border-orange-400"
          >
            <Satellite className="size-3.5" />
            {satellite ? "Street map" : "Satellite"}
          </button>
        </div>
        <div className="relative h-[560px] min-h-[560px] w-full">
          <LeafletMap
            subcontractors={visibleSubs}
            workOrders={visibleJobs}
            selectedId={selected?.id}
            selectedJobId={focusJobId}
            satellite={satellite}
            onSelectSubcontractor={(pin) => { if (!dispatchingId) chooseCrew(pin.id); }}
            onSelectWorkOrder={(pin) => { if (!dispatchingId && pin.id !== focusJobId) chooseJob(pin.id); }}
          />
        </div>
        {selected ? (
          <div className="border-t border-[#1f304d] bg-[#111f38] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-orange-300">Selected crew</p>
                <h3 className="mt-1 text-lg font-black text-white">{selected.companyName}</h3>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-300">
                  <MapPin className="size-3.5" />
                  {selected.city}, {selected.state}{selected.serviceRadius !== null ? ` · ${selected.serviceRadius} mi listed radius` : ""}
                </p>
                <div className="mt-3 rounded-lg border border-slate-700 p-3 text-sm text-slate-200">
                  <p className="text-xs font-bold uppercase text-slate-400">Company contact on file</p>
                  <p className="mt-1 font-semibold">{selected.contactName}</p>
                  {selected.email ? <p className="break-all">{selected.email}</p> : null}
                  {selected.phone ? <p>{selected.phone}</p> : null}
                </div>
                <details className="mt-3 max-w-xl rounded-lg border border-slate-700 p-3 text-sm text-slate-200">
                  <summary className="cursor-pointer font-bold">Past work · Unranked</summary>
                  <p className="mt-2 text-xs text-slate-300">Ranking requires comparable completed jobs with documented quality and a contractor-approved price for the same scope. This map does not have those records.</p>
                  {!historyAvailable ? <p className="mt-2 text-xs text-slate-300">Work-order history is not available in this session.</p> : (
                    <>
                      <p className="mt-2 text-xs font-semibold text-slate-300">
                        {evidenceTrade ? `Recorded trade: ${evidenceTrade}` : "All recorded trades"} · {selectedEvidence?.completedCount ?? 0} documented completions
                      </p>
                      {selectedEvidence ? (
                        <>
                          <p className="mt-1 text-xs text-slate-300">
                            {selectedEvidence.datedCount > 0
                              ? `${selectedEvidence.byRecordedDueDateCount}/${selectedEvidence.datedCount} completed by the recorded due date; ${selectedEvidence.completedCount - selectedEvidence.datedCount} had no recorded due date.`
                              : "No recorded due dates for these completions."}
                            {" The recorded due date does not establish an agreed crew schedule."}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            {costsAvailable
                              ? `Paid subcontractor costs with a receipt on file for ${selectedEvidence.receiptedPaidCostCount}/${selectedEvidence.completedCount} jobs. Entries may be partial, not an agreed price or a market rate.`
                              : "Receipted contractor cost records are unavailable."}
                          </p>
                          <ul className="mt-2 grid gap-1 text-xs">
                            {selectedEvidence.recentJobs.map((job) => (
                              <li key={job.id}>
                                <Link href={`/work-orders/${job.id}`} className="font-bold text-violet-200 underline">{job.number}</Link>
                                {" · "}{formatDate(job.completedDate)}
                                {job.dueDate ? ` · due ${formatDate(job.dueDate)}` : ""}
                                {job.recordedSubCost !== null ? ` · ${money(job.recordedSubCost)} receipted paid entries` : ""}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : <p className="mt-1 text-xs text-slate-300">No linked job has both a closed or billing-ready status and a recorded completion date in this view.</p>}
                    </>
                  )}
                </details>
                <p className="mt-2 text-sm text-slate-400">{selected.notes || selected.trades.join(", ") || "No notes yet."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white" href={selected.href}>
                    Open profile
                  </Link>
                  {selected.phone ? (
                    <a className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-black text-slate-200" href={`tel:${selected.phone}`}>
                      {selected.phone}
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="w-full min-w-0 max-w-full rounded-xl border border-[#223758] bg-[#0c172b] p-3 lg:max-w-xs">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Review dispatch</p>
                {!isActiveMapCrew(selected.status) ? (
                  <p className="mt-2 text-sm text-slate-400">This crew is not marked active. Dispatch unavailable here.</p>
                ) : reviewJob ? (
                  <div className="mt-2 grid gap-2">
                    <p className="text-sm font-bold text-white">{reviewJob.title}</p>
                    <p className="text-xs text-slate-400">
                      {reviewJob.city}, {reviewJob.state} · {reviewJob.status}
                    </p>
                    <p className="text-xs text-slate-300">
                      Assign this job to {selected.companyName} after you confirm the crew and the site.
                    </p>
                    <button
                      type="button"
                      disabled={dispatchingId === reviewJob.id}
                      onClick={() => void confirmDispatch()}
                      className="rounded-lg bg-orange-500 px-3 py-2 text-left text-xs font-black text-white hover:bg-orange-400"
                    >
                      {dispatchingId === reviewJob.id ? "Assigning..." : "Approve and assign"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewJobId(null)}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-left text-xs font-bold text-slate-200"
                    >
                      Back to jobs
                    </button>
                  </div>
                ) : unassignedJobs.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">No unassigned open jobs right now.</p>
                ) : (
                  <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto">
                    {unassignedJobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        disabled={dispatchingId === job.id}
                        onClick={() => {
                          setReviewJobId(job.id);
                          setDispatchMessage(null);
                        }}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-left text-xs text-slate-200 hover:border-orange-400"
                      >
                        <span className="block font-bold text-white">{job.title}</span>
                        <span className="text-slate-400">
                          {job.city}, {job.state} · {job.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {dispatchMessage ? <p className="mt-2 text-xs font-semibold text-orange-200">{dispatchMessage}</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function SubcontractorMapActions() {
  return (
    <Link className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" href="/subcontractors/new">
      <Plus className="mr-2 inline size-4" />
      Add subcontractor
    </Link>
  );
}
