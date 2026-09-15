import { NextResponse } from "next/server";
import {
  deleteMhelpdeskConnection,
  loadMhelpdeskConnection,
  saveMhelpdeskConnection,
  syncMhelpdeskJobs,
  type MhelpdeskConnection,
} from "../../../../lib/integrations/mhelpdesk";
import { isDemoMode } from "../../../../lib/env";
import { ensureDemoIntegrations } from "../../../../lib/integrations/demo-bootstrap";
import { normalizeMhelpdeskBaseUrl } from "../../../../lib/integrations/portal-jobs";

export async function GET() {
  if (isDemoMode()) await ensureDemoIntegrations();
  const connection = await loadMhelpdeskConnection();
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
      mode?: MhelpdeskConnection["mode"];
      notes?: string;
    };

    if (body.action === "disconnect") {
      await deleteMhelpdeskConnection();
      return NextResponse.json({ ok: true, connected: false });
    }

    if (body.action === "sync") {
      const result = await syncMhelpdeskJobs();
      return NextResponse.json({ ok: true, result });
    }

    const existing = await loadMhelpdeskConnection();
    const now = new Date().toISOString();
    const connection: MhelpdeskConnection = {
      provider: "mhelpdesk",
      baseUrl: normalizeMhelpdeskBaseUrl(body.baseUrl || existing?.baseUrl || "https://secure1.mhelpdesk.com"),
      email: body.email || existing?.email || "",
      password: body.password || existing?.password,
      mode: body.mode || existing?.mode || "email_bridge",
      notes: body.notes ?? existing?.notes,
      connectedAt: existing?.connectedAt || now,
      updatedAt: now,
      lastSyncAt: existing?.lastSyncAt,
    };

    if (!connection.email.trim()) {
      return NextResponse.json({ ok: false, error: "mHelpDesk login email is required." }, { status: 400 });
    }

    await saveMhelpdeskConnection(connection);
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
      { ok: false, error: error instanceof Error ? error.message : "mHelpDesk request failed." },
      { status: 400 }
    );
  }
}
