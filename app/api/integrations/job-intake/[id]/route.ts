import { NextResponse } from "next/server";
import {
  buildDefaultEmailDraft,
  getJobIntakeRecord,
  intakeToWorkOrderDraft,
  updateJobIntakeRecord,
  type JobIntakeStatus,
  type ParsedJobFields,
} from "../../../../../lib/integrations/job-intake";
import { stageMhelpdeskPush } from "../../../../../lib/integrations/mhelpdesk";
import { acceptJobIntake } from "../../../../../lib/integrations/accept-intake";
import { stampLoganApproval } from "../../../../../lib/integrations/dispatch-approval";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const record = await getJobIntakeRecord(id);
  if (!record) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    record,
    document: {
      title: record.parsed.description || record.subject || "Job brief",
      draft: intakeToWorkOrderDraft(record),
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: JobIntakeStatus;
      notes?: string;
      scheduledDate?: string | null;
      photoUrls?: string[];
      parsed?: ParsedJobFields;
      emailDraft?: {
        to?: string;
        cc?: string;
        subject?: string;
        body?: string;
        status?: "draft" | "approved" | "sent";
      };
      action?: "accept_to_tracker" | "refresh_email_draft" | "stage_mhelpdesk" | "approve_email";
    };

    const existing = await getJobIntakeRecord(id);
    if (!existing) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

    if (body.action === "refresh_email_draft") {
      const updated = await updateJobIntakeRecord(id, {
        emailDraft: buildDefaultEmailDraft({
          ...existing,
          notes: body.notes ?? existing.notes,
          scheduledDate: body.scheduledDate ?? existing.scheduledDate,
          parsed: body.parsed ? { ...existing.parsed, ...body.parsed } : existing.parsed,
        }),
      });
      return NextResponse.json({ ok: true, record: updated });
    }

    if (body.action === "approve_email") {
      const draft = {
        ...(existing.emailDraft ?? buildDefaultEmailDraft(existing)),
        ...body.emailDraft,
      };
      const updated = await updateJobIntakeRecord(id, {
        emailDraft: stampLoganApproval({ ...existing, emailDraft: draft }, draft),
      });
      return NextResponse.json({ ok: true, record: updated });
    }

    if (body.action === "stage_mhelpdesk") {
      const staged = await stageMhelpdeskPush(existing);
      const updated = await updateJobIntakeRecord(id, {
        mhelpdeskPush: staged,
        notes: body.notes ?? existing.notes,
        scheduledDate: body.scheduledDate ?? existing.scheduledDate,
      });
      return NextResponse.json({ ok: true, record: updated });
    }

    if (body.action === "accept_to_tracker") {
      const accepted = await acceptJobIntake(id, {
        notes: body.notes,
        scheduledDate: body.scheduledDate,
        parsed: body.parsed,
      });
      return NextResponse.json({
        ok: true,
        record: accepted.record,
        workOrderId: accepted.workOrderId,
        workOrderDraft: intakeToWorkOrderDraft(accepted.record),
        trackerLink: accepted.trackerLink,
        created: accepted.created,
      });
    }

    const nextDraft = body.emailDraft
      ? {
          ...(existing.emailDraft ?? buildDefaultEmailDraft(existing)),
          ...body.emailDraft,
          updatedAt: new Date().toISOString(),
        }
      : undefined;
    if (nextDraft?.status === "draft") {
      delete nextDraft.reviewedAt;
      delete nextDraft.approvedBy;
      delete nextDraft.approvalFingerprint;
    }

    const updated = await updateJobIntakeRecord(id, {
      status: body.status,
      notes: body.notes,
      scheduledDate: body.scheduledDate,
      photoUrls: body.photoUrls,
      parsed: body.parsed,
      emailDraft: nextDraft,
    });

    return NextResponse.json({ ok: true, record: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update job intake." },
      { status: 400 }
    );
  }
}
