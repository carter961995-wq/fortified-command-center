import { NextResponse } from "next/server";
import { sendReviewedJobIntakeEmail } from "../../../../../../../lib/integrations/dispatch-monitor";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      confirm?: boolean;
      to?: string;
      cc?: string;
      subject?: string;
      body?: string;
    };

    if (!body.confirm) {
      return NextResponse.json(
        { ok: false, error: "Set confirm:true after reviewing the draft. Nothing was sent." },
        { status: 400 }
      );
    }

    const result = await sendReviewedJobIntakeEmail({
      id,
      to: body.to,
      cc: body.cc,
      subject: body.subject,
      body: body.body,
    });

    return NextResponse.json({ ok: true, record: result.record, gmailMessageId: result.gmailMessageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email.";
    return NextResponse.json({ ok: false, error: message }, { status: message === "Not found." ? 404 : 400 });
  }
}
