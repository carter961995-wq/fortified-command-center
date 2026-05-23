"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

export type MeasurementPoint = {
  id: string;
  lat: number;
  lng: number;
};

export type MeasurementSegment = {
  id: string;
  from: MeasurementPoint;
  to: MeasurementPoint;
  feet: number;
};

export type MeasurementMapTarget = {
  center: [number, number];
  zoom: number;
  token: number;
};

const DEFAULT_CENTER: [number, number] = [33.749, -84.388];

function AddPointOnClick({ onAddPoint }: { onAddPoint: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onAddPoint(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function RecenterOnTarget({ target }: { target: MeasurementMapTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo(target.center, target.zoom, { duration: 0.75 });
  }, [map, target]);

  return null;
}

function segmentMidpoint(segment: MeasurementSegment): [number, number] {
  return [
    (segment.from.lat + segment.to.lat) / 2,
    (segment.from.lng + segment.to.lng) / 2,
  ];
}

function formatFeet(feet: number) {
  return `${feet.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft`;
}

export default function MeasurementToolMap({
  points,
  segments,
  mapTarget,
  onAddPoint,
}: {
  points: MeasurementPoint[];
  segments: MeasurementSegment[];
  mapTarget: MeasurementMapTarget | null;
  onAddPoint: (lat: number, lng: number) => void;
}) {
  return (
    <div className="relative min-h-[640px] overflow-hidden rounded-xl border border-[#1f304d] bg-[#0c172b]">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={18}
        minZoom={3}
        maxZoom={21}
        scrollWheelZoom
        className="h-[640px] min-h-[640px] w-full"
      >
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          maxNativeZoom={19}
          maxZoom={21}
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <AddPointOnClick onAddPoint={onAddPoint} />
        <RecenterOnTarget target={mapTarget} />

        {segments.map((segment, index) => (
          <Polyline
            key={segment.id}
            pathOptions={{
              color: "#f97316",
              opacity: 0.95,
              weight: 5,
            }}
            positions={[
              [segment.from.lat, segment.from.lng],
              [segment.to.lat, segment.to.lng],
            ]}
          >
            <Tooltip direction="center" permanent position={segmentMidpoint(segment)}>
              <span className="font-black text-slate-950">
                S{index + 1}: {formatFeet(segment.feet)}
              </span>
            </Tooltip>
          </Polyline>
        ))}

        {points.map((point, index) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            pathOptions={{
              color: "#ffffff",
              fillColor: index === 0 ? "#22c55e" : "#f97316",
              fillOpacity: 1,
              weight: 3,
            }}
            radius={8}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent>
              <span className="font-black text-slate-950">{index + 1}</span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute left-4 top-4 max-w-sm rounded-xl border border-white/20 bg-slate-950/85 p-3 text-xs font-semibold leading-5 text-slate-200 shadow-2xl backdrop-blur">
        Search an address, switch to the exact property in satellite view, then click each corner,
        gate opening, or fence run endpoint. Each click adds the next measured segment.
      </div>
    </div>
  );
}
