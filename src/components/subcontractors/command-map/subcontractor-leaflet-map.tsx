"use client";

import React from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import {
  clusterSubcontractors,
  milesToMeters,
  serviceRadiusToMarkerRadius,
} from "@/lib/subcontractors/geo";
import type { SubcontractorWrapSheet } from "@/lib/subcontractors/command-map-types";

interface SubcontractorLeafletMapProps {
  subcontractors: SubcontractorWrapSheet[];
  selectedId?: string;
  onSelectSubcontractor: (subcontractor: SubcontractorWrapSheet) => void;
}

export default function SubcontractorLeafletMap({
  subcontractors,
  selectedId,
  onSelectSubcontractor,
}: SubcontractorLeafletMapProps) {
  const clusters = clusterSubcontractors(subcontractors);

  return (
    <MapContainer
      center={[34.5, -89.5]}
      zoom={5}
      minZoom={4}
      maxZoom={12}
      scrollWheelZoom
      className="h-[620px] min-h-[520px] w-full rounded-b-2xl bg-slate-950"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {clusters.map((cluster) => {
        if (cluster.members.length > 1) {
          return (
            <CircleMarker
              key={cluster.id}
              center={[cluster.lat, cluster.lng]}
              radius={Math.min(34, 13 + cluster.members.length * 4)}
              pathOptions={{
                color: "#f59e0b",
                fillColor: "#f59e0b",
                fillOpacity: 0.88,
                weight: 2,
              }}
            >
              <Popup className="subcontractor-map-popup">
                <div className="min-w-56 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                      Clustered hub
                    </p>
                    <p className="text-sm font-semibold text-slate-950">
                      {cluster.members.length} subcontractors nearby
                    </p>
                  </div>
                  <div className="space-y-2">
                    {cluster.members.map((subcontractor) => (
                      <button
                        key={subcontractor.id}
                        type="button"
                        onClick={() => onSelectSubcontractor(subcontractor)}
                        className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50"
                      >
                        <span className="block font-semibold text-slate-950">
                          {subcontractor.companyName}
                        </span>
                        {subcontractor.location.city}, {subcontractor.location.state} ·{" "}
                        {subcontractor.service_radius} mi
                      </button>
                    ))}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        }

        const subcontractor = cluster.members[0];
        const selected = subcontractor.id === selectedId;

        return (
          <React.Fragment key={subcontractor.id}>
            <Circle
              center={[subcontractor.location.lat, subcontractor.location.lng]}
              radius={milesToMeters(subcontractor.service_radius)}
              pathOptions={{
                color: selected ? "#38bdf8" : "#10b981",
                fillColor: selected ? "#38bdf8" : "#10b981",
                fillOpacity: selected ? 0.12 : 0.08,
                weight: selected ? 2 : 1,
              }}
            />
            <CircleMarker
              center={[subcontractor.location.lat, subcontractor.location.lng]}
              radius={serviceRadiusToMarkerRadius(subcontractor.service_radius)}
              eventHandlers={{
                click: () => onSelectSubcontractor(subcontractor),
              }}
              pathOptions={{
                color: selected ? "#e0f2fe" : "#bbf7d0",
                fillColor: subcontractor.source === "ai" ? "#f59e0b" : "#10b981",
                fillOpacity: 0.92,
                weight: selected ? 4 : 2,
              }}
            >
              <Popup className="subcontractor-map-popup">
                <div className="min-w-56 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Active subcontractor
                    </p>
                    <p className="text-base font-semibold text-slate-950">
                      {subcontractor.companyName}
                    </p>
                  </div>
                  <div className="space-y-1 text-xs text-slate-700">
                    <p>
                      <span className="font-medium text-slate-900">Contact:</span>{" "}
                      {subcontractor.contactName}
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">Radius:</span>{" "}
                      {subcontractor.service_radius} miles
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">Base:</span>{" "}
                      {subcontractor.location.city}, {subcontractor.location.state}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSubcontractor(subcontractor)}
                    className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    View Profile
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}
