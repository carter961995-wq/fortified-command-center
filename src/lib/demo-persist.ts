import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const DEMO_PERSIST_TABLES = [
  "customers",
  "locations",
  "subcontractors",
  "work_orders",
] as const;

export type DemoPersistTable = (typeof DEMO_PERSIST_TABLES)[number];
export type DemoOverlay = Partial<Record<DemoPersistTable, Record<string, unknown>[]>>;

function overlayPath() {
  return path.join(dataDir(), "demo-records.json");
}

export function loadDemoOverlaySync(): DemoOverlay | null {
  try {
    const parsed = JSON.parse(readFileSync(overlayPath(), "utf8")) as DemoOverlay;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDemoOverlaySync(overlay: DemoOverlay) {
  const file = overlayPath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(overlay, null, 2), { mode: 0o600 });
}

export function isDemoPersistTable(table: string): table is DemoPersistTable {
  return (DEMO_PERSIST_TABLES as readonly string[]).includes(table);
}

export const LOCAL_PERSIST_TABLES = [
  "users_profile",
  "customers",
  "locations",
  "subcontractors",
  "work_orders",
  "quotes",
  "quote_line_items",
  "invoices",
  "invoice_line_items",
  "payments",
  "job_costs",
  "maintenance_contracts",
  "maintenance_visits",
  "work_order_photos",
  "work_order_documents",
] as const;

export type LocalPersistTable = (typeof LOCAL_PERSIST_TABLES)[number];
export type LocalSnapshot = Partial<Record<LocalPersistTable, Record<string, unknown>[]>>;

function dataDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

function localSnapshotPath() {
  return path.join(dataDir(), "local-records.json");
}

export function loadLocalSnapshotSync(): LocalSnapshot | null {
  try {
    const parsed = JSON.parse(readFileSync(localSnapshotPath(), "utf8")) as LocalSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalSnapshotSync(snapshot: LocalSnapshot) {
  const file = localSnapshotPath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
}
