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
  const lastSync = await loadLastSync();
  return NextResponse.json({
    demoMode: isDemoMode(),
    demoMailbox: isDemoGoogleConnection(connection),
    googleOAuthConfigured: googleOAuthConfigured(),
    geminiConfigured: geminiConfigured(),
    connected: Boolean(connection),
    email: connection?.email ?? null,
    name: connection?.name ?? null,
    scopes: connection?.scopes ?? [],
    connectedAt: connection?.connectedAt ?? null,
    updatedAt: connection?.updatedAt ?? null,
    redirectUri: googleRedirectUri(origin),
    lastSync,
  });
}
