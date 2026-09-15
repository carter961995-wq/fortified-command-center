import { NextResponse } from "next/server";
import {
  deleteTruesourceConnection,
  loadTruesourceConnection,
  saveTruesourceConnection,
  syncTruesourceJobs,
  type TruesourceConnection,
} from "../../../../lib/integrations/truesource";
import { isDemoMode } from "../../../../lib/env";
import { normalizeTruesourceBaseUrl } from "../../../../lib/integrations/portal-jobs";
import { ensureDemoIntegrations } from "../../../../lib/integrations/demo-bootstrap";

export async function GET() {
  if (isDemoMode()) await ensureDemoIntegrations();
  const connection = await loadTruesourceConnection();
  return NextResponse.json({
    ok: true,
    connected: Boolean(connection),
    connection: connection
      ? {
          provider: connection.provider,
          baseUrl: connection.baseUrl,
          email: connection.email,
          hasPassword: Boolean(connection.password),
          mode: connection.mode,
          connectedAt: connection.connectedAt,
          updatedAt: connection.updatedAt,
          lastSyncAt: connection.lastSyncAt,
          notes: connection.notes,
        }
      : null,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "save" | "disconnect" | "sync";
      baseUrl?: string;
      email?: string;
      password?: string;
      mode?: TruesourceConnection["mode"];
      notes?: string;
    };

    if (body.action === "disconnect") {
      await deleteTruesourceConnection();
      return NextResponse.json({ ok: true, connected: false });
    }

    if (body.action === "sync") {
      const result = await syncTruesourceJobs();
      return NextResponse.json({ ok: true, result });
    }

    const existing = await loadTruesourceConnection();
    const now = new Date().toISOString();
    const connection: TruesourceConnection = {
      provider: "truesource",
      baseUrl: normalizeTruesourceBaseUrl(body.baseUrl || existing?.baseUrl || "https://affiliateconnect.truesource.com"),
      email: body.email || existing?.email || "",
      password: body.password || existing?.password,
      mode: body.mode || existing?.mode || "email_bridge",
      notes: body.notes ?? existing?.notes,
      connectedAt: existing?.connectedAt || now,
      updatedAt: now,
      lastSyncAt: existing?.lastSyncAt,
    };

    if (!connection.email.trim()) {
      return NextResponse.json({ ok: false, error: "TrueSource login email is required." }, { status: 400 });
    }

    await saveTruesourceConnection(connection);
    return NextResponse.json({
      ok: true,
      connected: true,
      connection: {
        provider: connection.provider,
        baseUrl: connection.baseUrl,
        email: connection.email,
        hasPassword: Boolean(connection.password),
        mode: connection.mode,
        connectedAt: connection.connectedAt,
        updatedAt: connection.updatedAt,
        lastSyncAt: connection.lastSyncAt,
        notes: connection.notes,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "TrueSource request failed." },
      { status: 400 },
    );
  }
}
