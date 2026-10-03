"use client";

import { useEffect, useState, useTransition } from "react";
import { MapPin, Radio, RefreshCw } from "lucide-react";

type Contractor = {
  id: string;
  companyName: string;
  email?: string;
  city?: string;
  state?: string;
  serviceStates: string[];
  trades: string[];
  preferred: boolean;
  status: string;
};

type Route = {
  id: string;
  label: string;
  states: string[];
  cities: string[];
  zipPrefixes: string[];
  trades: string[];
  subcontractorId: string;
  active: boolean;
};

type MonitorState = {
  enabled: boolean;
  autoSend: boolean;
  intervalMs: number;
  lastTickAt?: string;
  lastError?: string;
  lastResult?: {
    message: string;
    assigned: number;
    sent: number;
    pendingReview?: number;
    needsContractor: number;
    items: Array<{
      intakeId: string;
      workOrderNumber?: string;
      status: string;
      contractorName?: string;
      fortifiedWorkOrderNumber?: string;
      detail: string;
    }>;
  };
};

export function DispatchMonitorPanel() {
  const [state, setState] = useState<MonitorState | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState("");
  const [states, setStates] = useState("");
  const [cities, setCities] = useState("");
  const [trades, setTrades] = useState("");
  const [subcontractorId, setSubcontractorId] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadRoutes() {
    const response = await fetch("/api/integrations/dispatch-routes");
    const body = await response.json();
    if (!response.ok) return;
    setRoutes(body.routes ?? []);
    setContractors(body.contractors ?? []);
    if (!subcontractorId && body.contractors?.[0]?.id) setSubcontractorId(body.contractors[0].id);
  }

  async function loadState() {
    const response = await fetch("/api/integrations/dispatch-monitor");
    const body = await response.json();
    if (response.ok) setState(body.state);
  }

  useEffect(() => {
    const start = window.setTimeout(() => {
      void loadState();
      void loadRoutes();
    }, 0);
    const timer = window.setInterval(() => {
      void loadState();
    }, 15000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tick(action: "start" | "stop" | "tick") {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/integrations/dispatch-monitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Dispatch check failed.");
        return;
      }
      setState(body.state);
      setMessage(body.summary?.message || (action === "stop" ? "Watching is paused." : "Checked the sources."));
    });
  }

  function saveRoute() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/integrations/dispatch-routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          route: { label, states, cities, trades, subcontractorId },
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Could not save the route.");
        return;
      }
      setRoutes(body.routes ?? []);
      setLabel("");
      setStates("");
      setCities("");
      setTrades("");
      setMessage("Location route saved. The next new work order in that area goes to this contractor.");
    });
  }

  function removeRoute(id: string) {
    startTransition(async () => {
      const response = await fetch("/api/integrations/dispatch-routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const body = await response.json();
      if (response.ok) setRoutes(body.routes ?? []);
    });
  }

  const watching = state?.enabled !== false;
  const recent = state?.lastResult?.items?.slice(0, 5) ?? [];
  const contractorName = (id: string) => contractors.find((contractor) => contractor.id === id)?.companyName || "Contractor";

  return (
    <section className="grid gap-4 rounded-xl border border-orange-400/40 bg-[#13233f] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-orange-300">
            <Radio className="size-4" />
            Live dispatch
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">Watch for new work orders</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
            The Command Center keeps checking mHelpDesk, Affiliate Connect, and Gmail. A new work order is matched to
            the contractor for that location and held in Job Intake. Review the crew, photos, and subcontractor
            not-to-exceed, then approve and send. Their not-to-exceed is half of the DNE we received.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${watching ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-700 text-slate-200"}`}>
            {watching ? "Watching" : "Paused"}
          </span>
          <button className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-slate-950" disabled={isPending} onClick={() => tick("tick")} type="button">
            <RefreshCw className="mr-1 inline size-3.5" />
            Check now
          </button>
          <button
            className="rounded-lg border border-slate-500 px-3 py-2 text-xs font-black text-white"
            disabled={isPending}
            onClick={() => tick(watching ? "stop" : "start")}
            type="button"
          >
            {watching ? "Pause" : "Start watching"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-[#0c172b] p-3">
          <p className="text-[11px] font-black uppercase text-slate-400">Last check</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {state?.lastTickAt ? new Date(state.lastTickAt).toLocaleString() : "Waiting for the first check"}
          </p>
        </div>
        <div className="rounded-lg bg-[#0c172b] p-3">
          <p className="text-[11px] font-black uppercase text-slate-400">Review / sent</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {state?.lastResult
              ? `${state.lastResult.pendingReview ?? 0} to review · ${state.lastResult.sent} sent`
              : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-[#0c172b] p-3 text-sm font-semibold text-slate-100">
          Emails and crew assignments wait until someone reviews them in Job Intake.
        </div>
      </div>

      {state?.lastError ? <p className="text-sm font-semibold text-red-300">{state.lastError}</p> : null}
      {message ? <p className="text-sm font-semibold text-orange-100">{message}</p> : null}
      {state?.lastResult?.message ? <p className="text-sm text-slate-300">{state.lastResult.message}</p> : null}

      {recent.length ? (
        <div className="grid gap-2">
          {recent.map((item) => (
            <div className="rounded-lg border border-[#2a4063] px-3 py-2 text-sm text-slate-200" key={item.intakeId}>
              <span className="font-black text-white">{item.fortifiedWorkOrderNumber || item.workOrderNumber || "Work order"}</span>
              {" · "}
              {item.contractorName || item.status.replaceAll("_", " ")}
              <span className="mt-1 block text-xs text-slate-400">{item.detail}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 border-t border-[#2a4063] pt-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <h3 className="flex items-center gap-2 font-black text-white">
            <MapPin className="size-4 text-orange-300" />
            Who gets which location
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            A route wins first. If no route matches, the active subcontractor whose service states include the job
            state is used, with preferred crews and the matching trade first.
          </p>
          <div className="mt-3 grid gap-2">
            {routes.length ? (
              routes.map((route) => (
                <div className="flex items-start justify-between gap-3 rounded-lg bg-[#0c172b] px-3 py-2" key={route.id}>
                  <div>
                    <p className="font-bold text-white">{route.label}</p>
                    <p className="text-xs text-slate-300">
                      {[route.states.join(", "), route.cities.join(", "), route.trades.join(", ")].filter(Boolean).join(" · ")}
                      {" → "}
                      {contractorName(route.subcontractorId)}
                    </p>
                  </div>
                  <button className="text-xs font-black text-orange-300" onClick={() => removeRoute(route.id)} type="button">
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No extra routes yet. Service states on each subcontractor still decide the crew.</p>
            )}
          </div>
        </div>

        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveRoute();
          }}
        >
          <input className="rounded-lg border border-[#2a4063] bg-[#0c172b] px-3 py-2 text-sm text-white" onChange={(event) => setLabel(event.target.value)} placeholder="Route name, such as New Orleans gates" value={label} />
          <input className="rounded-lg border border-[#2a4063] bg-[#0c172b] px-3 py-2 text-sm text-white" onChange={(event) => setStates(event.target.value)} placeholder="States, such as LA, MS" value={states} />
          <input className="rounded-lg border border-[#2a4063] bg-[#0c172b] px-3 py-2 text-sm text-white" onChange={(event) => setCities(event.target.value)} placeholder="Cities, optional" value={cities} />
          <input className="rounded-lg border border-[#2a4063] bg-[#0c172b] px-3 py-2 text-sm text-white" onChange={(event) => setTrades(event.target.value)} placeholder="Trades, optional, such as gate" value={trades} />
          <select className="rounded-lg border border-[#2a4063] bg-[#0c172b] px-3 py-2 text-sm text-white" onChange={(event) => setSubcontractorId(event.target.value)} value={subcontractorId}>
            {contractors.length ? (
              contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.companyName}
                  {contractor.serviceStates.length ? ` · ${contractor.serviceStates.join(", ")}` : ""}
                  {contractor.status !== "active" ? ` · ${contractor.status}` : ""}
                </option>
              ))
            ) : (
              <option value="">Add a subcontractor first</option>
            )}
          </select>
          <button className="rounded-lg border border-orange-400 px-3 py-2 text-sm font-black text-orange-200" disabled={isPending || !subcontractorId} type="submit">
            Save location route
          </button>
        </form>
      </div>
    </section>
  );
}
