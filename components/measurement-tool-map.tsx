"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Polyline,
  ScaleControl,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

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

const DEFAULT_CENTER: [number, number] = [30.4515, -91.1871];

const GOOGLE_SAT =
  "https://{s}.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&scale=2";
const GOOGLE_HYBRID =
  "https://{s}.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&scale=2";
const ESRI_SAT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

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
    const handle = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(handle);
  }, [map]);

  useEffect(() => {
    if (!target) return;
    map.flyTo(target.center, target.zoom, { duration: 0.75 });
  }, [map, target]);

  return null;
}

function segmentMidpoint(segment: MeasurementSegment): [number, number] {
  return [(segment.from.lat + segment.to.lat) / 2, (segment.from.lng + segment.to.lng) / 2];
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
    <div className="relative min-h-[75vh] overflow-hidden rounded-xl border border-[#1f304d] bg-[#0c172b]">
      <MapContainer
        center={DEFAULT_CENTER}
        className="h-[75vh] min-h-[75vh] w-full"
        doubleClickZoom={false}
        maxZoom={22}
        minZoom={3}
        scrollWheelZoom
        zoom={19}
        zoomDelta={0.5}
        zoomSnap={0.5}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Google Satellite (sharpest)">
            <TileLayer
              attribution="Imagery &copy; Google"
              keepBuffer={8}
              maxNativeZoom={22}
              maxZoom={22}
              minZoom={3}
              subdomains={["mt0", "mt1", "mt2", "mt3"]}
              updateWhenIdle
              updateWhenZooming={false}
              url={GOOGLE_SAT}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Google Hybrid (labels)">
            <TileLayer
              attribution="Imagery &copy; Google"
              keepBuffer={8}
              maxNativeZoom={22}
              maxZoom={22}
              minZoom={3}
              subdomains={["mt0", "mt1", "mt2", "mt3"]}
              updateWhenIdle
              updateWhenZooming={false}
              url={GOOGLE_HYBRID}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Esri World Imagery">
            <TileLayer
              attribution="Tiles &copy; Esri, Maxar"
              detectRetina
              keepBuffer={8}
              maxNativeZoom={19}
              maxZoom={22}
              url={ESRI_SAT}
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <ScaleControl imperial metric={false} position="bottomleft" />
        <AddPointOnClick onAddPoint={onAddPoint} />
        <RecenterOnTarget target={mapTarget} />

        {segments.map((segment, index) => (
          <Polyline
            key={segment.id}
            pathOptions={{
              color: "#f97316",
              opacity: 0.95,
              weight: 4,
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
            radius={6}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent>
              <span className="font-black text-slate-950">{index + 1}</span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-8 left-4 max-w-sm rounded-xl border border-white/20 bg-slate-950/85 p-3 text-xs font-semibold leading-5 text-slate-200 shadow-2xl backdrop-blur">
        Zoom in until posts, gates, vehicles, and patio details are readable. Click exact corners.
        Use the layer picker for Hybrid labels if you need street names.
      </div>
    </div>
  );
}
