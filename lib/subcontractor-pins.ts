import { normalizeStateCode, resolveCoordinates } from "../src/lib/subcontractors/geo";
import { hasRecordedMapCoordinates, recordedServiceRadius } from "./subcontractor-map-coverage";
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
  serviceRadius: number | null;
  hasRecordedCoordinates: boolean;
  recordedState: string;
  status: string;
  preferred: boolean;
  notes: string;
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
  hasRecordedCoordinates: boolean;
  recordedState: string;
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

export function toSubcontractorPins(rows: PlainRow[]): SubcontractorMapPin[] {
  return rows.flatMap((row) => {
    const hasRecordedCoordinates = hasRecordedMapCoordinates(row.service_latitude, row.service_longitude);
    const coords = resolveCoordinates({
      city: asString(row.city),
      state: asString(row.state) || asStringList(row.service_states)[0],
      lat: hasRecordedCoordinates ? row.service_latitude as number : undefined,
      lng: hasRecordedCoordinates ? row.service_longitude as number : undefined,
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
        serviceStates: asStringList(row.service_states).map(normalizeStateCode).filter(Boolean),
        serviceRadius: recordedServiceRadius(row.service_radius_miles),
        hasRecordedCoordinates,
        recordedState: normalizeStateCode(asString(row.state)),
        status: asString(row.status, "unknown"),
        preferred: Boolean(row.preferred_vendor ?? row.is_preferred),
        notes: asString(row.notes),
        href: `/subcontractors/${asString(row.id)}`,
      },
    ];
  });
}

export function toWorkOrderPins(rows: PlainRow[]): WorkOrderMapPin[] {
  return rows.flatMap((row) => {
    const location = asRecord(row.locations) ?? asRecord(row.location);
    const customer = asRecord(row.customers) ?? asRecord(row.customer);
    const hasRecordedCoordinates = hasRecordedMapCoordinates(location?.latitude, location?.longitude);
    const coords = resolveCoordinates({
      city: asString(location?.city),
      state: asString(location?.state),
      lat: hasRecordedCoordinates ? location?.latitude as number : undefined,
      lng: hasRecordedCoordinates ? location?.longitude as number : undefined,
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
        hasRecordedCoordinates,
        recordedState: normalizeStateCode(asString(location?.state)),
        subcontractorId: row.subcontractor_id ? asString(row.subcontractor_id) : null,
        href: `/work-orders/${asString(row.id)}`,
      },
    ];
  });
}
