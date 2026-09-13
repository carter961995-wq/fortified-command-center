import { isDemoMode } from "../env";
import {
  DEMO_GOOGLE_TOKEN,
  googleScopes,
  loadGoogleConnection,
  loadLastSync,
  saveGoogleConnection,
  syncGoogleWorkspace,
  type GoogleConnection,
} from "./google";
import {
  loadMhelpdeskConnection,
  saveMhelpdeskConnection,
  syncMhelpdeskJobs,
} from "./mhelpdesk";
import {
  loadTruesourceConnection,
  saveTruesourceConnection,
  syncTruesourceJobs,
} from "./truesource";
import { ensureGptApiKey } from "./gpt-bridge";

let bootstrapping: Promise<void> | null = null;

export async function ensureDemoIntegrations() {
  if (!isDemoMode()) return;
  if (!bootstrapping) {
    bootstrapping = bootstrapDemoIntegrations().finally(() => {
      bootstrapping = null;
    });
  }
  await bootstrapping;
}

async function bootstrapDemoIntegrations() {
  const now = new Date().toISOString();
  const google = await loadGoogleConnection();
  if (!google) {
    const connection: GoogleConnection = {
      provider: "google",
      email: "demo@fortified.local",
      name: "Demo Admin",
      accessToken: DEMO_GOOGLE_TOKEN,
      refreshToken: "demo-refresh",
      expiresAt: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
      scopes: googleScopes,
      connectedAt: now,
      updatedAt: now,
    };
    await saveGoogleConnection(connection);
  }

  const mhelpdesk = await loadMhelpdeskConnection();
  if (!mhelpdesk) {
    await saveMhelpdeskConnection({
      provider: "mhelpdesk",
      baseUrl: "https://app.mhelpdesk.com",
      email: "dispatch@fortified.local",
      mode: "session_sync",
      notes: "Demo shop mailbox. Assignment emails and staged dashboard jobs land in Job Intake.",
      connectedAt: now,
      updatedAt: now,
    });
  }

  const truesource = await loadTruesourceConnection();
  if (!truesource) {
    await saveTruesourceConnection({
      provider: "truesource",
      baseUrl: "https://truesource.com",
      email: "affiliate@fortified.local",
      mode: "session_sync",
      notes: "Demo Affiliate Connect login. National-account jobs land in Job Intake.",
      connectedAt: now,
      updatedAt: now,
    });
  }

  await ensureGptApiKey();

  const lastSync = await loadLastSync();
  if (!lastSync) {
    await syncGoogleWorkspace();
    await syncMhelpdeskJobs();
    await syncTruesourceJobs();
  }
}
