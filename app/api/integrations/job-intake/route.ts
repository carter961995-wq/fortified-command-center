import { NextResponse } from "next/server";
import {
  ensureSeedJobIntake,
  parseJobAssignmentText,
  upsertJobIntakeFromSource,
} from "../../../../lib/integrations/job-intake";

export async function GET() {
  const store = await ensureSeedJobIntake();
  return NextResponse.json({
    ok: true,
    updatedAt: store.updatedAt,
    records: store.records,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subject?: string;
      from?: string;
      rawText?: string;
      sourceRef?: string;
    };

    if (!body.rawText?.trim()) {
      return NextResponse.json({ ok: false, error: "rawText is required." }, { status: 400 });
    }

    const parsed = await parseJobAssignmentText({
      subject: body.subject,
      from: body.from,
      body: body.rawText,
    });

    const { record, created } = await upsertJobIntakeFromSource({
      source: "manual",
      sourceRef: body.sourceRef || `manual-${Date.now()}`,
      subject: body.subject || "Manual job import",
      from: body.from,
      snippet: body.rawText.slice(0, 160),
      rawText: body.rawText,
      parsed,
    });

    return NextResponse.json({ ok: true, created, record });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create job intake." },
      { status: 400 }
    );
  }
}
