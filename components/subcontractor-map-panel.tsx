"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2, MapPin, Plus, Radar, Search, Satellite } from "lucide-react";
import { assignWorkOrderSubcontractor } from "../lib/actions";
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
}: {
  subcontractors: SubcontractorMapPin[];
  workOrders: WorkOrderMapPin[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [satellite, setSatellite] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const visibleSubs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return subcontractors;
    return subcontractors.filter((pin) =>
      [pin.companyName, pin.city, pin.state, pin.contactName, pin.trades.join(" "), pin.serviceStates.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, subcontractors]);

  const selected = visibleSubs.find((pin) => pin.id === selectedId) ?? subcontractors.find((pin) => pin.id === selectedId);
  const openJobs = workOrders.filter((job) => !["Closed", "Cancelled", "Paid"].includes(job.status));
  const unassignedJobs = openJobs.filter((job) => !job.subcontractorId);

  async function dispatchJob(workOrderId: string) {
    if (!selected) return;
    setDispatchingId(workOrderId);
    setDispatchMessage(null);
    try {
      const result = await assignWorkOrderSubcontractor(workOrderId, selected.id);
      setDispatchMessage(result.error ?? `Dispatched ${selected.companyName} to the job.`);
    } catch (error) {
      setDispatchMessage(error instanceof Error ? error.message : "Dispatch failed.");
    } finally {
      setDispatchingId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="overflow-hidden rounded-xl border border-[#1f304d] bg-[#111f38]">
        <div className="border-b border-[#1f304d] p-4">
          <label className="flex items-center gap-2 rounded-lg border border-[#223758] bg-[#0c172b] px-3 py-2 text-slate-300">
            <Search className="size-4 shrink-0 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search crews, cities, specialty..."
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <p className="mt-3 text-xs font-bold text-slate-500">
            {visibleSubs.length} of {subcontractors.length} crews · {openJobs.length} open jobs on the map
          </p>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {visibleSubs.map((pin) => (
            <button
              type="button"
              key={pin.id}
              onClick={() => setSelectedId(pin.id)}
              className={`block w-full border-b border-[#1f304d] p-4 text-left hover:bg-[#172844] ${
                selectedId === pin.id ? "bg-[#172844]" : ""
              }`}
            >
              <div className="flex gap-3">
                <span
                  className="mt-1 size-3 rounded-full"
                  style={{ backgroundColor: pin.preferred ? "#f97316" : pin.status === "active" ? "#34d399" : "#f59e0b" }}
                />
                <div>
                  <p className="font-black text-white">{pin.companyName}</p>
                  <p className="text-xs font-semibold text-slate-400">
                    {pin.city}, {pin.state} · {pin.serviceRadius} mi
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{pin.trades.join(", ") || "Trades TBD"}</p>
                </div>
              </div>
            </button>
          ))}
          {visibleSubs.length === 0 ? (
            <p className="p-4 text-sm font-semibold text-slate-400">No crews match that search.</p>
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
        <div className="relative min-h-[560px]">
          <LeafletMap
            subcontractors={visibleSubs}
            workOrders={openJobs}
            selectedId={selected?.id}
            satellite={satellite}
            onSelectSubcontractor={(pin) => setSelectedId(pin.id)}
            onSelectWorkOrder={() => undefined}
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
                  {selected.city}, {selected.state} · {selected.serviceRadius} mile radius
                </p>
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
              <div className="min-w-[240px] rounded-xl border border-[#223758] bg-[#0c172b] p-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Dispatch unassigned job</p>
                {unassignedJobs.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">No unassigned open jobs right now.</p>
                ) : (
                  <div className="mt-2 grid gap-2">
                    {unassignedJobs.slice(0, 4).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        disabled={dispatchingId === job.id}
                        onClick={() => dispatchJob(job.id)}
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
