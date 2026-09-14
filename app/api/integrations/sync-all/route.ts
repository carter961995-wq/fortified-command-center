import { NextResponse } from "next/server";
import { isDemoMode } from "../../../../lib/env";
import { ensureDemoIntegrations } from "../../../../lib/integrations/demo-bootstrap";
import { loadLastSourceSync, syncAllJobSources } from "../../../../lib/integrations/source-sync";

export async function GET() {
  if (isDemoMode()) await ensureDemoIntegrations();
  const last = await loadLastSourceSync();
  return NextResponse.json({ ok: true, summary: last });
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) await ensureDemoIntegrations();
    const body = (await request.json().catch(() => ({}))) as { force?: boolean; auto?: boolean };
    const summary = await syncAllJobSources({ force: body.force || !body.auto });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Source sync failed." },
      { status: 400 }
    );
  }
}
