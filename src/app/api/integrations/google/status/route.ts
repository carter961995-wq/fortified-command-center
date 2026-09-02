import { NextResponse } from "next/server";
import {
  geminiConfigured,
  googleOAuthConfigured,
  googleRedirectUri,
  loadGoogleConnection,
  loadLastSync,
} from "../../../../../../lib/integrations/google";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const connection = await loadGoogleConnection();
  const lastSync = await loadLastSync();
  return NextResponse.json({
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
