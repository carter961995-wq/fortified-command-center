import { NextResponse } from "next/server";
import {
  geminiConfigured,
  googleOAuthConfigured,
  googleRedirectUri,
  isDemoGoogleConnection,
  loadGoogleConnection,
  loadLastSync,
} from "../../../../../lib/integrations/google";
import { isDemoMode } from "../../../../../lib/env";
import { ensureDemoIntegrations } from "../../../../../lib/integrations/demo-bootstrap";

export async function GET(request: Request) {
  if (isDemoMode()) await ensureDemoIntegrations();
  const origin = new URL(request.url).origin;
  const connection = await loadGoogleConnection();
  const liveConnection = isDemoMode() || !isDemoGoogleConnection(connection) ? connection : null;
  const lastSync = await loadLastSync();
  return NextResponse.json({
    demoMode: isDemoMode(),
    demoMailbox: Boolean(isDemoMode() && isDemoGoogleConnection(connection)),
    googleOAuthConfigured: googleOAuthConfigured(),
    geminiConfigured: geminiConfigured(),
    connected: Boolean(liveConnection),
    email: liveConnection?.email ?? null,
    name: liveConnection?.name ?? null,
    scopes: liveConnection?.scopes ?? [],
    connectedAt: liveConnection?.connectedAt ?? null,
    updatedAt: liveConnection?.updatedAt ?? null,
    redirectUri: googleRedirectUri(origin),
    lastSync,
  });
}
