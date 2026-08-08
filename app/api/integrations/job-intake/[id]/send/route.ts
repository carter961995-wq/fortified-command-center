import { NextResponse } from "next/server";
import { buildDefaultEmailDraft, getJobIntakeRecord, updateJobIntakeRecord } from "../../../../../../lib/integrations/job-intake";
import { sendApprovedGmailDraft } from "../../../../../../lib/integrations/google";

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

    const record = await getJobIntakeRecord(id);
    if (!record) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

    const draft = {
      ...(record.emailDraft ?? buildDefaultEmailDraft(record)),
      ...(body.to ? { to: body.to } : {}),
      ...(body.cc ? { cc: body.cc } : {}),
      ...(body.subject ? { subject: body.subject } : {}),
      ...(body.body ? { body: body.body } : {}),
    };

    if (!draft.to?.trim()) {
      return NextResponse.json({ ok: false, error: "Draft is missing a recipient." }, { status: 400 });
    }
    if (draft.status !== "approved" && draft.status !== "draft") {
      return NextResponse.json({ ok: false, error: "Approve the draft before sending." }, { status: 400 });
    }

    // Require explicit approve step in the UI; allow send only when approved.
    if (draft.status !== "approved") {
      return NextResponse.json(
        { ok: false, error: "Approve the email draft first, then send." },
        { status: 400 }
      );
    }

    const sent = await sendApprovedGmailDraft({
      to: draft.to,
      cc: draft.cc,
      subject: draft.subject,
      body: draft.body,
    });

    const updated = await updateJobIntakeRecord(id, {
      emailDraft: {
        ...draft,
        status: "sent",
        updatedAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ ok: true, record: updated, gmailMessageId: sent.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to send email." },
      { status: 400 }
    );
  }
}
