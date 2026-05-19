"use client";

import dynamic from "next/dynamic";
import { FormEvent, useMemo, useState } from "react";
import {
  Archive,
  Bot,
  Building2,
  ClipboardList,
  Loader2,
  MapPin,
  Plus,
  Radar,
  Route,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTIVE_OPERATIONAL_STATES,
  type AiSourcingRecommendation,
  type OperationalState,
  type SubcontractorWrapSheet,
} from "@/lib/subcontractors/command-map-types";
import { INITIAL_COMMAND_MAP_SUBCONTRACTORS } from "@/lib/subcontractors/command-map-seed";
import {
  calculateMilesBetween,
  inferLocationFromQuery,
  isOperationalState,
  STATE_FALLBACK_COORDINATES,
} from "@/lib/subcontractors/geo";
import { cn } from "@/lib/utils";

const LeafletMap = dynamic(() => import("./subcontractor-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[620px] min-h-[520px] items-center justify-center rounded-b-2xl bg-slate-950 text-slate-300">
      <Loader2 className="mr-2 size-5 animate-spin" />
      Loading command map...
    </div>
  ),
});

const defaultState: OperationalState = "GA";

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function splitCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createBlankSubcontractor(state: OperationalState = defaultState): SubcontractorWrapSheet {
  const fallback = STATE_FALLBACK_COORDINATES[state];

  return {
    id: createClientId("sub"),
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    location: {
      city: fallback.city,
      state,
      lat: fallback.lat,
      lng: fallback.lng,
    },
    service_radius: 75,
    skills: [],
    activeCities: [fallback.city],
    pricingTier: "",
    waitsForPayout: false,
    notes: "",
    historicalPerformance: "",
    source: "network",
  };
}

function recommendationToDraft(
  recommendation: AiSourcingRecommendation,
  query: string,
  selectedState: OperationalState | null
): SubcontractorWrapSheet {
  const inferredLocation = inferLocationFromQuery(
    `${recommendation.city ?? ""} ${recommendation.state ?? ""} ${query}`
  );
  const candidateState = recommendation.state ?? inferredLocation?.state ?? selectedState ?? defaultState;
  const state = isOperationalState(candidateState) ? candidateState : defaultState;
  const fallback = inferredLocation ?? STATE_FALLBACK_COORDINATES[state];

  return {
    id: createClientId("ai-sub"),
    companyName: recommendation.companyName,
    contactName: "Primary contact TBD",
    phone: recommendation.phone,
    email: "",
    website: recommendation.website,
    location: {
      city: recommendation.city || fallback.city,
      state,
      lat: recommendation.lat ?? fallback.lat,
      lng: recommendation.lng ?? fallback.lng,
    },
    service_radius: 75,
    skills: recommendation.skills?.length ? recommendation.skills : ["Welding", "Commercial Fence"],
    activeCities: [recommendation.city || fallback.city],
    pricingTier: "AI lead - rates not confirmed",
    waitsForPayout: true,
    notes: recommendation.summary ?? `Sourced from AI query: "${query}"`,
    historicalPerformance: "New AI sourced lead. Verify license, insurance, W-9, and references before dispatch.",
    source: "ai",
  };
}

export function SubcontractorCommandMap() {
  const [subcontractors, setSubcontractors] = useState<SubcontractorWrapSheet[]>(
    INITIAL_COMMAND_MAP_SUBCONTRACTORS
  );
  const [selectedState, setSelectedState] = useState<OperationalState | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<SubcontractorWrapSheet>(() =>
    createBlankSubcontractor()
  );
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState<AiSourcingRecommendation[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const visibleSubcontractors = useMemo(
    () =>
      subcontractors.filter(
        (subcontractor) =>
          !subcontractor.archived &&
          (!selectedState || subcontractor.location.state === selectedState)
      ),
    [selectedState, subcontractors]
  );

  const stateCounts = useMemo(() => {
    return ACTIVE_OPERATIONAL_STATES.reduce<Record<OperationalState, number>>(
      (counts, state) => {
        counts[state] = subcontractors.filter(
          (subcontractor) => !subcontractor.archived && subcontractor.location.state === state
        ).length;
        return counts;
      },
      {} as Record<OperationalState, number>
    );
  }, [subcontractors]);

  const selectedSubcontractor = subcontractors.find(
    (subcontractor) => subcontractor.id === selectedId
  );

  const queryCoverageMessage = useMemo(() => {
    const queryLocation = inferLocationFromQuery(query);
    if (!queryLocation) return null;

    const coveredBy = subcontractors.find((subcontractor) => {
      if (subcontractor.archived) return false;

      return (
        calculateMilesBetween(queryLocation, subcontractor.location) <=
        subcontractor.service_radius
      );
    });

    if (coveredBy) {
      return `${coveredBy.companyName} already covers ${queryLocation.city}, ${queryLocation.state}. You can still source alternates.`;
    }

    return `No active dot currently covers ${queryLocation.city}, ${queryLocation.state}; AI sourcing will search for new leads.`;
  }, [query, subcontractors]);

  function openSubcontractor(subcontractor: SubcontractorWrapSheet) {
    setSelectedId(subcontractor.id);
    setDraft({ ...subcontractor, location: { ...subcontractor.location } });
    setDrawerOpen(true);
  }

  function handleStateSelect(state: OperationalState) {
    const nextState = selectedState === state ? null : state;
    setSelectedState(nextState);

    if (nextState) {
      const firstInState = subcontractors.find(
        (subcontractor) => !subcontractor.archived && subcontractor.location.state === nextState
      );
      if (firstInState) openSubcontractor(firstInState);
    }
  }

  function handleAddNew() {
    const newDraft = createBlankSubcontractor(selectedState ?? defaultState);
    setSelectedId(undefined);
    setDraft(newDraft);
    setDrawerOpen(true);
  }

  function handleSave() {
    const cleanDraft: SubcontractorWrapSheet = {
      ...draft,
      companyName: draft.companyName.trim() || "Unnamed Subcontractor",
      contactName: draft.contactName.trim() || "Primary contact TBD",
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      website: draft.website?.trim() || undefined,
      skills: draft.skills.map((skill) => skill.trim()).filter(Boolean),
      activeCities: draft.activeCities.map((city) => city.trim()).filter(Boolean),
      service_radius: Math.max(10, Number(draft.service_radius) || 75),
      location: {
        ...draft.location,
        city: draft.location.city.trim() || STATE_FALLBACK_COORDINATES[draft.location.state].city,
        lat: Number(draft.location.lat),
        lng: Number(draft.location.lng),
      },
    };

    setSubcontractors((current) => {
      const exists = current.some((subcontractor) => subcontractor.id === cleanDraft.id);
      if (exists) {
        return current.map((subcontractor) =>
          subcontractor.id === cleanDraft.id ? cleanDraft : subcontractor
        );
      }

      return [...current, cleanDraft];
    });
    setSelectedId(cleanDraft.id);
    setDrawerOpen(false);
  }

  function handleArchive() {
    setSubcontractors((current) =>
      current.map((subcontractor) =>
        subcontractor.id === draft.id ? { ...subcontractor, archived: true } : subcontractor
      )
    );
    setDrawerOpen(false);
    setSelectedId(undefined);
  }

  async function handleAiSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;

    setAiStatus("loading");
    setAiError(null);
    setRecommendations([]);

    try {
      const response = await fetch("/api/source-subcontractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          activeStates: ACTIVE_OPERATIONAL_STATES,
          existingSubcontractors: subcontractors
            .filter((subcontractor) => !subcontractor.archived)
            .map((subcontractor) => ({
              companyName: subcontractor.companyName,
              city: subcontractor.location.city,
              state: subcontractor.location.state,
              service_radius: subcontractor.service_radius,
              skills: subcontractor.skills,
            })),
        }),
      });
      const payload = (await response.json()) as {
        recommendations?: AiSourcingRecommendation[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "AI sourcing failed");
      }

      setRecommendations(payload.recommendations ?? []);
      setAiStatus("success");
    } catch (error) {
      setAiStatus("error");
      setAiError(error instanceof Error ? error.message : "AI sourcing failed");
    }
  }

  function handleQuickAdd(recommendation: AiSourcingRecommendation) {
    const nextDraft = recommendationToDraft(recommendation, query, selectedState);
    setSelectedId(undefined);
    setDraft(nextDraft);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-slate-800 bg-slate-950 text-slate-50 shadow-2xl">
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-emerald-400/40 bg-emerald-400/10 text-emerald-200">
                  <Radar className="size-3" />
                  8-state operational network
                </Badge>
                <Badge className="border-amber-400/40 bg-amber-400/10 text-amber-200">
                  <Sparkles className="size-3" />
                  AI lead capture
                </Badge>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Interactive Subcontractor Command Map
                </h2>
                <p className="max-w-3xl text-sm text-slate-300">
                  Plot subcontractors by precise city coordinates, visualize service radius
                  coverage, open wrap sheets, and source new trade partners for uncovered
                  markets.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleAddNew}
              className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            >
              <Plus className="size-4" />
              Add Subcontractor
            </Button>
          </div>

          <form
            onSubmit={handleAiSearch}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-inner"
          >
            <Label
              htmlFor="ai-sourcing-search"
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100"
            >
              <Bot className="size-4 text-emerald-300" />
              AI Sourcing Assistant: Find Subs in New Areas
            </Label>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="ai-sourcing-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Try "Find commercial welders in Chattanooga, TN"'
                  className="h-11 border-slate-700 bg-slate-950 pl-9 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                disabled={aiStatus === "loading" || !query.trim()}
                className="h-11 bg-sky-500 text-slate-950 hover:bg-sky-400"
              >
                {aiStatus === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Source Leads
              </Button>
            </div>
            {queryCoverageMessage && (
              <p className="mt-2 text-xs text-slate-400">{queryCoverageMessage}</p>
            )}

            {(recommendations.length > 0 || aiError) && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                {aiError ? (
                  <div className="p-3 text-sm text-amber-200">{aiError}</div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {recommendations.map((recommendation) => (
                      <div
                        key={recommendation.id}
                        className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-100">
                              {recommendation.companyName}
                            </span>
                            <Badge className="border-amber-400/40 bg-amber-400/10 text-amber-200">
                              {recommendation.proximity || "proximity TBD"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400">
                            {recommendation.phone || "phone TBD"}
                            {recommendation.website ? ` · ${recommendation.website}` : ""}
                          </p>
                          {recommendation.summary && (
                            <p className="max-w-3xl text-xs text-slate-500">
                              {recommendation.summary}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleQuickAdd(recommendation)}
                          className="bg-amber-400 text-slate-950 hover:bg-amber-300"
                        >
                          <Plus className="size-3.5" />
                          Add to Network
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        </CardContent>

        <div className="grid border-t border-slate-800 lg:grid-cols-[280px_1fr]">
          <aside className="border-b border-slate-800 bg-slate-950/95 p-4 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">State coverage</p>
                <p className="text-xs text-slate-500">Click a state to filter and open a lead.</p>
              </div>
              {selectedState && (
                <button
                  type="button"
                  onClick={() => setSelectedState(null)}
                  className="text-xs text-slate-400 hover:text-slate-100"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {ACTIVE_OPERATIONAL_STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => handleStateSelect(state)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                    selectedState === state
                      ? "border-emerald-400 bg-emerald-400/10 text-emerald-100"
                      : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:bg-slate-900"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    {state}
                  </span>
                  <Badge variant="outline" className="border-slate-700 text-slate-300">
                    {stateCounts[state]}
                  </Badge>
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {selectedState ? `${selectedState} filtered subs` : "Visible subs"}
              </p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {visibleSubcontractors.map((subcontractor) => (
                  <button
                    key={subcontractor.id}
                    type="button"
                    onClick={() => openSubcontractor(subcontractor)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition",
                      subcontractor.id === selectedId
                        ? "border-sky-300 bg-sky-400/10"
                        : "border-slate-800 bg-slate-900/60 hover:border-emerald-400/60"
                    )}
                  >
                    <span className="block text-sm font-semibold text-slate-100">
                      {subcontractor.companyName}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Route className="size-3" />
                      {subcontractor.location.city}, {subcontractor.location.state} ·{" "}
                      {subcontractor.service_radius} mi
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <LeafletMap
            subcontractors={visibleSubcontractors}
            selectedId={selectedSubcontractor?.id}
            onSelectSubcontractor={openSubcontractor}
          />
        </div>
      </Card>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex bg-slate-950/70 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close wrap sheet"
            className="hidden flex-1 cursor-default md:block"
            onClick={() => setDrawerOpen(false)}
          />
          <section className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 p-5">
              <div className="space-y-2">
                <Badge
                  className={cn(
                    "w-fit",
                    draft.source === "ai"
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                      : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  )}
                >
                  {draft.source === "ai" ? "Pending AI lead" : "Active subcontractor"}
                </Badge>
                <div>
                  <h3 className="text-xl font-semibold">Subcontractor Wrap Sheet</h3>
                  <p className="text-sm text-slate-400">
                    CRUD profile, cash-flow tracker, rates, notes, and performance log.
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={draft.companyName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, companyName: event.target.value }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Owner / Primary Contact</Label>
                  <Input
                    id="contactName"
                    value={draft.contactName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, contactName: event.target.value }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={draft.phone}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, phone: event.target.value }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={draft.email}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, email: event.target.value }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={draft.website ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, website: event.target.value }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={draft.location.city}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        location: { ...current.location, city: event.target.value },
                      }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <select
                    id="state"
                    value={draft.location.state}
                    onChange={(event) => {
                      const state = event.target.value as OperationalState;
                      const fallback = STATE_FALLBACK_COORDINATES[state];
                      setDraft((current) => ({
                        ...current,
                        location: {
                          ...current.location,
                          state,
                          lat: fallback.lat,
                          lng: fallback.lng,
                        },
                      }));
                    }}
                    className="h-8 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-sm"
                  >
                    {ACTIVE_OPERATIONAL_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceRadius">Service Radius</Label>
                  <Input
                    id="serviceRadius"
                    type="number"
                    value={draft.service_radius}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        service_radius: Number(event.target.value),
                      }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="0.0001"
                    value={draft.location.lat}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        location: { ...current.location, lat: Number(event.target.value) },
                      }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="0.0001"
                    value={draft.location.lng}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        location: { ...current.location, lng: Number(event.target.value) },
                      }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="skills">Core Skills</Label>
                  <Input
                    id="skills"
                    value={draft.skills.join(", ")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        skills: splitCommaList(event.target.value),
                      }))
                    }
                    placeholder="Custom Ironwork, Welding, Automation Gates"
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activeCities">Active Cities Covered</Label>
                  <Input
                    id="activeCities"
                    value={draft.activeCities.join(", ")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        activeCities: splitCommaList(event.target.value),
                      }))
                    }
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricingTier">Pricing Tier / Rates</Label>
                  <Input
                    id="pricingTier"
                    value={draft.pricingTier}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, pricingTier: event.target.value }))
                    }
                    placeholder="Flat emergency rate, hourly welding rate"
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <ShieldCheck className="size-4 text-emerald-300" />
                      Waits for Corporate Payout
                    </span>
                    <span className="text-xs text-slate-500">
                      Track whether this sub floats work until corporate pays.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.waitsForPayout}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        waitsForPayout: event.target.checked,
                      }))
                    }
                    className="size-5 rounded border-slate-600 bg-slate-950 accent-emerald-400"
                  />
                </label>
                <div className="space-y-2">
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea
                    id="notes"
                    value={draft.notes}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, notes: event.target.value }))
                    }
                    rows={4}
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="performanceLog">Historical Performance Log</Label>
                  <Textarea
                    id="performanceLog"
                    value={draft.historicalPerformance}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        historicalPerformance: event.target.value,
                      }))
                    }
                    rows={4}
                    className="border-slate-700 bg-slate-900"
                  />
                </div>
              </section>
            </div>

            <div className="grid gap-2 border-t border-slate-800 p-5 sm:grid-cols-[1fr_auto_auto]">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Building2 className="size-4" />
                {draft.activeCities.join(", ") || "No cities listed"}
                <ClipboardList className="ml-2 size-4" />
                {draft.skills.length} skills
              </div>
              {subcontractors.some((subcontractor) => subcontractor.id === draft.id) && (
                <Button type="button" variant="destructive" onClick={handleArchive}>
                  <Archive className="size-4" />
                  Archive
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSave}
                className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              >
                <Save className="size-4" />
                Save Profile
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
