import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { upsertJobIntakeFromSource } from "./job-intake";

export type TruesourceConnection = {
  provider: "truesource";
  baseUrl: string;
  email: string;
  password?: string;
  connectedAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  mode: "email_bridge" | "session_sync" | "manual";
  notes?: string;
};

export type TruesourceSyncResult = {
  syncedAt: string;
  mode: TruesourceConnection["mode"];
  imported: number;
  message: string;
  jobs: Array<{ sourceRef: string; title: string }>;
};

function integrationDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

function connectionPath() {
  return path.join(integrationDir(), "truesource-connection.json");
}

async function ensureDir() {
  await mkdir(integrationDir(), { recursive: true });
}

export async function loadTruesourceConnection(): Promise<TruesourceConnection | null> {
  try {
    const raw = await readFile(connectionPath(), "utf8");
    return JSON.parse(raw) as TruesourceConnection;
  } catch {
    return null;
  }
}

export async function saveTruesourceConnection(connection: TruesourceConnection) {
  await ensureDir();
  await writeFile(connectionPath(), JSON.stringify(connection, null, 2), { mode: 0o600 });
  return connection;
}

export async function deleteTruesourceConnection() {
  await rm(connectionPath(), { force: true });
}

export async function syncTruesourceJobs(): Promise<TruesourceSyncResult> {
  const connection = await loadTruesourceConnection();
  const syncedAt = new Date().toISOString();

  if (!connection) {
    return {
      syncedAt,
      mode: "manual",
      imported: 0,
      message: "TrueSource is not connected. Save the Affiliate Connect login or use email bridge.",
      jobs: [],
    };
  }

  if (connection.mode === "email_bridge") {
    return {
      syncedAt,
      mode: "email_bridge",
      imported: 0,
      message: "Email bridge mode is active. Run Google Workspace sync to import TrueSource / Affiliate Connect assignment emails.",
      jobs: [],
    };
  }

  if (connection.mode === "session_sync") {
    const demoBody = `TrueSource Affiliate Connect assignment

Customer: ${connection.email.split("@")[0] || "National Account"}
Store #: 1844
Location: Home Depot lumber canopy
Address: 2200 S Cooper St
City: Arlington
State: TX
Zip: 76013
Work Order #: TS-${Date.now().toString().slice(-6)}
Description: Dock leveler not cycling / safety gate inspect
Details: Affiliate Connect dispatch. Check leveler hydraulics and adjacent safety gate.
DNE: $1800.00
Timeframe: 24 hour response
Priority: High
Contact: TrueSource Dispatch
Email: dispatch@truesource.com`;

    const sourceRef = `truesource-demo-${new Date().toISOString().slice(0, 10)}`;
    const { record, created } = await upsertJobIntakeFromSource({
      source: "truesource",
      sourceRef,
      subject: "TrueSource · Affiliate Connect job",
      from: connection.email,
      snippet: "New TrueSource affiliate assignment",
      rawText: demoBody,
    });

    const updated = {
      ...connection,
      lastSyncAt: syncedAt,
      updatedAt: syncedAt,
    };
    await saveTruesourceConnection(updated);

    return {
      syncedAt,
      mode: "session_sync",
      imported: created ? 1 : 0,
      message: created
        ? "Imported a sample TrueSource / Affiliate Connect job into Job Intake."
        : "No new TrueSource jobs found (sample assignment already imported today).",
      jobs: [
        {
          sourceRef: record.sourceRef,
          title: record.parsed.description || record.subject || "TrueSource job",
        },
      ],
    };
  }

  return {
    syncedAt,
    mode: "manual",
    imported: 0,
    message: "Manual mode: paste Affiliate Connect job text on the Job Intake page.",
    jobs: [],
  };
}
