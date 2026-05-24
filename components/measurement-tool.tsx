"use client";

import dynamic from "next/dynamic";
import { FormEvent, useMemo, useState } from "react";
import {
  Copy,
  CornerDownRight,
  LocateFixed,
  MapPin,
  RotateCcw,
  Ruler,
  Satellite,
  Undo2,
} from "lucide-react";
import type {
  MeasurementMapTarget,
  MeasurementPoint,
  MeasurementSegment,
} from "./measurement-tool-map";

const MeasurementMap = dynamic(() => import("./measurement-tool-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[640px] min-h-[640px] items-center justify-center rounded-xl border border-[#1f304d] bg-[#0c172b] text-sm font-bold text-slate-400">
      Loading satellite measurement map...
    </div>
  ),
});

type GeocodeResult = {
  lat: string;
  lon: string;
  display_name: string;
};

const EARTH_RADIUS_FEET = 20_925_524.9;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function feetBetween(a: Pick<MeasurementPoint, "lat" | "lng">, b: Pick<MeasurementPoint, "lat" | "lng">) {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_FEET * Math.asin(Math.sqrt(haversine));
}

function formatFeet(feet: number, digits = 1) {
  return feet.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function createPoint(lat: number, lng: number): MeasurementPoint {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${lat}-${lng}`;

  return { id, lat, lng };
}

function buildSegments(points: MeasurementPoint[]): MeasurementSegment[] {
  return points.slice(1).map((point, index) => {
    const previous = points[index];

    return {
      id: `${previous.id}-${point.id}`,
      from: previous,
      to: point,
      feet: feetBetween(previous, point),
    };
  });
}

function coordinateLabel(point: MeasurementPoint) {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

export function MeasurementTool() {
  const [points, setPoints] = useState<MeasurementPoint[]>([]);
  const [address, setAddress] = useState("");
  const [jobName, setJobName] = useState("Property line takeoff");
  const [searchStatus, setSearchStatus] = useState<"idle" | "searching" | "found" | "error">("idle");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [mapTarget, setMapTarget] = useState<MeasurementMapTarget | null>(null);

  const segments = useMemo(() => buildSegments(points), [points]);
  const totalFeet = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.feet, 0),
    [segments]
  );
  const estimatedEightFootSections = totalFeet > 0 ? Math.ceil(totalFeet / 8) : 0;
  const estimatedLinePosts = segments.length > 0 ? estimatedEightFootSections + 1 : 0;

  function handleAddPoint(lat: number, lng: number) {
    setPoints((current) => [...current, createPoint(lat, lng)]);
    setCopyStatus(null);
  }

  function handleUndo() {
    setPoints((current) => current.slice(0, -1));
    setCopyStatus(null);
  }

  function handleReset() {
    setPoints([]);
    setCopyStatus(null);
  }

  function handleCloseLoop() {
    setPoints((current) => {
      if (current.length < 3) return current;
      const first = current[0];
      const last = current[current.length - 1];

      if (Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lng - last.lng) < 0.000001) {
        return current;
      }

      return [...current, createPoint(first.lat, first.lng)];
    });
    setCopyStatus(null);
  }

  async function handleAddressSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = address.trim();
    if (!query) return;

    setSearchStatus("searching");
    setSearchMessage(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Address lookup failed. Pan and zoom the map manually, then start measuring.");
      }

      const results = (await response.json()) as GeocodeResult[];
      const result = results[0];

      if (!result) {
        throw new Error("No matching address found. Try a fuller street address or zoom manually.");
      }

      const lat = Number(result.lat);
      const lng = Number(result.lon);

      setMapTarget({
        center: [lat, lng],
        zoom: 20,
        token: Date.now(),
      });
      setSearchStatus("found");
      setSearchMessage(result.display_name);
    } catch (error) {
      setSearchStatus("error");
      setSearchMessage(error instanceof Error ? error.message : "Address lookup failed.");
    }
  }

  async function copySummary() {
    const lines = [
      jobName.trim() || "Property line takeoff",
      address.trim() ? `Address/search: ${address.trim()}` : "Address/search: not provided",
      `Total measured line: ${formatFeet(totalFeet)} linear ft`,
      `Segments: ${segments.length}`,
      ...segments.map(
        (segment, index) =>
          `S${index + 1}: ${formatFeet(segment.feet)} ft (${coordinateLabel(segment.from)} -> ${coordinateLabel(segment.to)})`
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("Copied measurement summary.");
    } catch {
      setCopyStatus("Copy failed. Select the segment table and copy manually.");
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-orange-300">
              <Satellite className="size-3.5" />
              Satellite takeoff
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-300">
              <Ruler className="size-3.5" />
              Linear feet
            </span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Measurement Tool
          </h1>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-400">
            Measure property lines, fence runs, and gate openings from aerial imagery. Click
            endpoints in order and the tool calculates each segment plus total linear feet.
          </p>
        </div>
        <div className="rounded-xl border border-[#1f304d] bg-[#111f38] px-4 py-3 text-sm font-black text-white">
          {formatFeet(totalFeet)} <span className="text-slate-400">linear ft</span>
        </div>
      </header>

      <section className="grid gap-4 rounded-xl border border-[#1f304d] bg-[#111f38] p-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <form onSubmit={handleAddressSearch} className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
          <label>
            Takeoff name
            <input
              value={jobName}
              onChange={(event) => setJobName(event.target.value)}
              placeholder="North fence repair"
            />
          </label>
          <label>
            Property address
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="123 Main St, Atlanta, GA"
            />
          </label>
          <button
            className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 md:self-end"
            disabled={searchStatus === "searching" || !address.trim()}
            type="submit"
          >
            <LocateFixed className="size-4" />
            {searchStatus === "searching" ? "Locating..." : "Find property"}
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2b4168] bg-[#0c172b] px-4 py-3 text-sm font-black text-slate-200 hover:bg-[#14233d] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={points.length === 0}
            onClick={handleUndo}
            type="button"
          >
            <Undo2 className="size-4" />
            Undo
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2b4168] bg-[#0c172b] px-4 py-3 text-sm font-black text-slate-200 hover:bg-[#14233d] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={points.length < 3}
            onClick={handleCloseLoop}
            type="button"
          >
            <CornerDownRight className="size-4" />
            Close loop
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2b4168] bg-[#0c172b] px-4 py-3 text-sm font-black text-slate-200 hover:bg-[#14233d] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={points.length === 0}
            onClick={handleReset}
            type="button"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
        </div>

        {searchMessage && (
          <p
            className={`text-sm font-semibold lg:col-span-2 ${
              searchStatus === "error" ? "text-red-300" : "text-slate-400"
            }`}
          >
            {searchStatus === "found" ? "Centered map on: " : ""}
            {searchMessage}
          </p>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MeasurementMap
          mapTarget={mapTarget}
          points={points}
          segments={segments}
          onAddPoint={handleAddPoint}
        />

        <aside className="grid content-start gap-4">
          <section className="rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">
                  Takeoff total
                </p>
                <p className="mt-2 text-4xl font-black text-white">{formatFeet(totalFeet)}</p>
                <p className="text-sm font-bold text-slate-400">linear feet</p>
              </div>
              <Ruler className="size-8 text-orange-400" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-3">
                <p className="text-xs font-black uppercase text-slate-500">Segments</p>
                <p className="mt-1 text-2xl font-black text-white">{segments.length}</p>
              </div>
              <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-3">
                <p className="text-xs font-black uppercase text-slate-500">Points</p>
                <p className="mt-1 text-2xl font-black text-white">{points.length}</p>
              </div>
              <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-3">
                <p className="text-xs font-black uppercase text-slate-500">8 ft sections</p>
                <p className="mt-1 text-2xl font-black text-white">{estimatedEightFootSections}</p>
              </div>
              <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-3">
                <p className="text-xs font-black uppercase text-slate-500">Line posts</p>
                <p className="mt-1 text-2xl font-black text-white">{estimatedLinePosts}</p>
              </div>
            </div>

            <button
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              disabled={segments.length === 0}
              onClick={copySummary}
              type="button"
            >
              <Copy className="size-4" />
              Copy summary
            </button>
            {copyStatus && <p className="mt-2 text-xs font-bold text-slate-400">{copyStatus}</p>}
          </section>

          <section className="rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">
              Segment log
            </p>
            <div className="mt-4 grid gap-3">
              {segments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#2b4168] bg-[#0c172b] p-5 text-sm font-semibold leading-6 text-slate-400">
                  <MapPin className="mb-2 size-5 text-orange-400" />
                  Click the satellite map to add at least two points and create the first measured
                  fence or property-line segment.
                </div>
              ) : (
                segments.map((segment, index) => (
                  <div
                    className="rounded-xl border border-[#223758] bg-[#0c172b] p-3"
                    key={segment.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-white">Segment {index + 1}</p>
                      <p className="font-black text-orange-300">{formatFeet(segment.feet)} ft</p>
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      {coordinateLabel(segment.from)} to {coordinateLabel(segment.to)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-semibold leading-5 text-amber-100">
            Aerial measurements are useful for estimating and material takeoffs. Confirm final
            legal property boundaries against survey/GIS records before treating a line as a
            recorded property boundary.
          </section>
        </aside>
      </div>
    </div>
  );
}
