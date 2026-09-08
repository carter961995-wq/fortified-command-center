"use client";

import React, { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
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

function FitNetwork({ subcontractors, selectedId }: { subcontractors: SubcontractorWrapSheet[]; selectedId?: string }) {
  const map = useMap();

  useEffect(() => {
    const handle = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(handle);
  }, [map]);

  useEffect(() => {
    const selected = subcontractors.find((item) => item.id === selectedId);
    if (selected) {
      map.flyTo([selected.location.lat, selected.location.lng], Math.max(map.getZoom(), 7), { duration: 0.55 });
      return;
    }
    if (subcontractors.length === 0) {
      map.setView([34.5, -89.5], 5);
      return;
    }
    const bounds = L.latLngBounds(subcontractors.map((item) => [item.location.lat, item.location.lng]));
    map.fitBounds(bounds.pad(0.2), { maxZoom: 7 });
  }, [map, selectedId, subcontractors]);

  return null;
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
      maxZoom={14}
      scrollWheelZoom
      className="h-[620px] min-h-[520px] w-full rounded-b-2xl bg-[#d7e3ea]"
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, TomTom, Garmin, FAO, NOAA, USGS"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={19}
        maxZoom={14}
      />
      <FitNetwork subcontractors={subcontractors} selectedId={selectedId} />

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
