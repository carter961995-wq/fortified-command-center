import { resolveCoordinates } from "../src/lib/subcontractors/geo";
import type { PlainRow } from "./business";

export type SubcontractorMapPin = {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  trades: string[];
  serviceStates: string[];
  serviceRadius: number;
  status: string;
  preferred: boolean;
  notes: string;
  qualityScore: number | null;
  href: string;
};

export type WorkOrderMapPin = {
  id: string;
  title: string;
  number: string;
  status: string;
  priority: string;
  trade: string;
  customerName: string;
  locationName: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  subcontractorId: string | null;
  href: string;
};

function asRecord(value: unknown): PlainRow | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as PlainRow) : null;
  }
  return value as PlainRow;
}

function asString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asStringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [] as string[];
}

function asNumber(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function toSubcontractorPins(rows: PlainRow[]): SubcontractorMapPin[] {
  return rows.flatMap((row) => {
    const coords = resolveCoordinates({
      city: asString(row.city),
      state: asString(row.state) || asStringList(row.service_states)[0],
      lat: row.service_latitude as number | null,
      lng: row.service_longitude as number | null,
    });
    if (!coords) return [];

    return [
      {
        id: asString(row.id),
        companyName: asString(row.company_name, "Unnamed crew"),
        contactName: asString(row.owner_name, "Primary contact TBD"),
        phone: asString(row.phone),
        email: asString(row.email),
        city: coords.city,
        state: coords.state,
        lat: coords.lat,
        lng: coords.lng,
        trades: asStringList(row.trades),
        serviceStates: asStringList(row.service_states),
        serviceRadius: Math.max(25, asNumber(row.service_radius_miles) ?? 75),
        status: asString(row.status, "active"),
        preferred: Boolean(row.preferred_vendor ?? row.is_preferred),
        notes: asString(row.notes),
        qualityScore: asNumber(row.quality_score),
        href: `/subcontractors/${asString(row.id)}`,
      },
    ];
  });
}

export function toWorkOrderPins(rows: PlainRow[]): WorkOrderMapPin[] {
  return rows.flatMap((row) => {
    const location = asRecord(row.locations) ?? asRecord(row.location);
    const customer = asRecord(row.customers) ?? asRecord(row.customer);
    const coords = resolveCoordinates({
      city: asString(location?.city),
      state: asString(location?.state),
      lat: location?.latitude as number | null,
      lng: location?.longitude as number | null,
    });
    if (!coords) return [];

    const closed = ["Closed", "Cancelled", "Paid"].includes(asString(row.status));
    if (closed) return [];

    return [
      {
        id: asString(row.id),
        title: asString(row.title, "Work order"),
        number: asString(row.work_order_number, asString(row.customer_work_order_number)),
        status: asString(row.status, "New"),
        priority: asString(row.priority, "normal"),
        trade: asString(row.trade_type),
        customerName: asString(customer?.company_name, "Customer"),
        locationName: asString(location?.location_name ?? location?.name, coords.city),
        city: coords.city,
        state: coords.state,
        lat: coords.lat,
        lng: coords.lng,
        subcontractorId: row.subcontractor_id ? asString(row.subcontractor_id) : null,
        href: `/work-orders/${asString(row.id)}`,
      },
    ];
  });
}
