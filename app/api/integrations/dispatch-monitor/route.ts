import { NextResponse } from "next/server";
import { isDemoMode } from "../../../../lib/env";
import { ensureDemoIntegrations } from "../../../../lib/integrations/demo-bootstrap";
import {
  ensureDispatchMonitor,
  loadDispatchMonitorState,
  runDispatchCycle,
  setDispatchMonitorEnabled,
  updateDispatchMonitorSettings,
} from "../../../../lib/integrations/dispatch-monitor";

export async function GET() {
  if (isDemoMode()) await ensureDemoIntegrations();
  const state = await ensureDispatchMonitor();
  return NextResponse.json({ ok: true, state });
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) await ensureDemoIntegrations();
    const body = (await request.json().catch(() => ({}))) as {
      action?: "start" | "stop" | "tick" | "settings";
      autoSend?: boolean;
      intervalMs?: number;
    };

    if (body.action === "stop") {
      const state = await setDispatchMonitorEnabled(false);
      return NextResponse.json({ ok: true, state });
    }

    if (body.action === "settings") {
      const state = await updateDispatchMonitorSettings({
        autoSend: body.autoSend,
        intervalMs: body.intervalMs,
      });
      return NextResponse.json({ ok: true, state });
    }

    if (body.action === "start" || !body.action) {
      await setDispatchMonitorEnabled(true);
    }

    const summary = await runDispatchCycle({ sync: true, force: body.action === "tick" });
    const state = await loadDispatchMonitorState();
    return NextResponse.json({ ok: true, state, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Dispatch monitor failed." },
      { status: 400 }
    );
  }
}
