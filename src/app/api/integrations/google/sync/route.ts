import { NextResponse } from "next/server";
import { syncGoogleWorkspace } from "../../../../../../lib/integrations/google";

export async function POST() {
  try {
    const summary = await syncGoogleWorkspace();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Google Workspace sync failed." },
      { status: 400 }
    );
  }
}
