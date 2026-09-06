"use client";

import { Fragment, useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { milesToMeters } from "../src/lib/subcontractors/geo";
import type { SubcontractorMapPin, WorkOrderMapPin } from "../lib/subcontractor-pins";

const STREET_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABEL_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

const DEFAULT_CENTER: [number, number] = [32.6, -90.2];

function statusColor(status: string) {
  const value = status.toLowerCase();
  if (value === "blocked") return "#ef4444";
  if (value === "probation" || value === "inactive") return "#f59e0b";
  return "#10b981";
}

function FitPins({
  subPins,
  jobPins,
  selectedId,
}: {
  subPins: SubcontractorMapPin[];
  jobPins: WorkOrderMapPin[];
  selectedId?: string;
}) {
  const map = useMap();

  useEffect(() => {
    const handle = window.setTimeout(() => map.invalidateSize(), 60);
    return () => window.clearTimeout(handle);
  }, [map]);

  useEffect(() => {
    const selected = subPins.find((pin) => pin.id === selectedId);
    if (selected) {
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 8), { duration: 0.6 });
      return;
    }

    const points = [
      ...subPins.map((pin) => [pin.lat, pin.lng] as [number, number]),
      ...jobPins.map((pin) => [pin.lat, pin.lng] as [number, number]),
    ];
    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, 5);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 8);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 8 });
  }, [jobPins, map, selectedId, subPins]);

  return null;
}

export default function SubcontractorMapLeaflet({
  subcontractors,
  workOrders,
  selectedId,
  satellite,
  onSelectSubcontractor,
  onSelectWorkOrder,
}: {
  subcontractors: SubcontractorMapPin[];
  workOrders: WorkOrderMapPin[];
  selectedId?: string;
  satellite: boolean;
  onSelectSubcontractor: (pin: SubcontractorMapPin) => void;
  onSelectWorkOrder: (pin: WorkOrderMapPin) => void;
}) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={6}
      minZoom={4}
      maxZoom={18}
      scrollWheelZoom
      className="h-full min-h-[560px] w-full"
    >
      <TileLayer
        attribution={
          satellite
            ? "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
            : "Tiles &copy; Esri &mdash; Esri, TomTom, Garmin, FAO, NOAA, USGS"
        }
        url={satellite ? SATELLITE_TILES : STREET_TILES}
        maxNativeZoom={19}
        maxZoom={18}
      />
      {satellite ? <TileLayer url={LABEL_TILES} pane="overlayPane" /> : null}
      <FitPins subPins={subcontractors} jobPins={workOrders} selectedId={selectedId} />

      {subcontractors.map((pin) => {
        const selected = pin.id === selectedId;
        const color = selected ? "#38bdf8" : statusColor(pin.status);
        return (
          <Fragment key={pin.id}>
            <Circle
              center={[pin.lat, pin.lng]}
              radius={milesToMeters(pin.serviceRadius)}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: selected ? 0.16 : 0.08,
                weight: selected ? 2 : 1,
              }}
            />
            <CircleMarker
              center={[pin.lat, pin.lng]}
              radius={selected ? 11 : 8}
              eventHandlers={{ click: () => onSelectSubcontractor(pin) }}
              pathOptions={{
                color: "#ffffff",
                fillColor: pin.preferred ? "#f97316" : color,
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <div className="min-w-52 space-y-1 text-slate-900">
                  <p className="text-sm font-black">{pin.companyName}</p>
                  <p className="text-xs">
                    {pin.city}, {pin.state} · {pin.serviceRadius} mi radius
                  </p>
                  <p className="text-xs">{pin.trades.join(", ") || "Trade TBD"}</p>
                  <button
                    type="button"
                    className="mt-2 w-full rounded bg-slate-950 px-2 py-1 text-xs font-bold text-white"
                    onClick={() => onSelectSubcontractor(pin)}
                  >
                    Open crew card
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}

      {workOrders.map((pin) => (
        <CircleMarker
          key={pin.id}
          center={[pin.lat, pin.lng]}
          radius={6}
          eventHandlers={{ click: () => onSelectWorkOrder(pin) }}
          pathOptions={{
            color: "#ffffff",
            fillColor: pin.subcontractorId ? "#38bdf8" : "#f97316",
            fillOpacity: 1,
            weight: 2,
          }}
        >
          <Popup>
            <div className="min-w-52 space-y-1 text-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Job site</p>
              <p className="text-sm font-black">{pin.title}</p>
              <p className="text-xs">
                {pin.customerName} · {pin.locationName}
              </p>
              <p className="text-xs">
                {pin.city}, {pin.state} · {pin.status}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
