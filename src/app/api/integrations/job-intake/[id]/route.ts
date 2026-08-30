import { NextResponse } from "next/server";
import {
  buildDefaultEmailDraft,
  buildMhelpdeskFieldMap,
  getJobIntakeRecord,
  intakeToWorkOrderDraft,
  updateJobIntakeRecord,
  type JobIntakeStatus,
  type ParsedJobFields,
} from "@/lib/integrations/job-intake";
import { stageMhelpdeskPush } from "@/lib/integrations/mhelpdesk";
import { createClient } from "@/lib/supabase/server";
import { nextWorkOrderNumber } from "@/lib/document-numbers";

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
      const draft = existing.emailDraft ?? buildDefaultEmailDraft(existing);
      const updated = await updateJobIntakeRecord(id, {
        emailDraft: {
          ...draft,
          ...body.emailDraft,
          status: "approved",
          updatedAt: new Date().toISOString(),
        },
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
      const draft = intakeToWorkOrderDraft({
        ...existing,
        notes: body.notes ?? existing.notes,
        scheduledDate: body.scheduledDate ?? existing.scheduledDate,
        parsed: body.parsed ? { ...existing.parsed, ...body.parsed } : existing.parsed,
      });

      let workOrderId: string | null = existing.workOrderId ?? null;

      if (!workOrderId) {
        const supabase = await createClient();
        const { data: customers } = await supabase.from("customers").select("id").order("company_name").limit(1);
        const { data: locations } = await supabase.from("locations").select("id").limit(1);
        const customerId = customers?.[0]?.id;
        const locationId = locations?.[0]?.id;

        if (customerId && locationId) {
          const work_order_number = await nextWorkOrderNumber(supabase);
          const priority =
            /emergency/i.test(draft.priority) ? "emergency" : /urgent|high/i.test(draft.priority) ? "urgent" : "normal";
          const { data, error } = await supabase
            .from("work_orders")
            .insert({
              work_order_number,
              customer_id: customerId,
              location_id: locationId,
              title: draft.title,
              scope_summary: draft.scope_summary,
              trade_type: draft.trade_type,
              priority,
              status: "New",
              source: existing.source === "truesource" ? "facilities_network" : existing.source === "mhelpdesk" ? "facilities_network" : "other",
              customer_work_order_number: draft.customer_work_order_number,
              purchase_order_number: draft.purchase_order_number,
              not_to_exceed_amount: draft.not_to_exceed_amount,
              requested_date: draft.requested_date,
              due_date: draft.due_date,
              scheduled_date: draft.scheduled_date,
              customer_notes: draft.customer_notes,
              internal_notes: draft.internal_notes,
            })
            .select("id")
            .maybeSingle();

          if (!error && data?.id) {
            workOrderId = String(data.id);
          }
        }
      }

      if (!workOrderId) {
        workOrderId = `local-${id}`;
      }

      const updated = await updateJobIntakeRecord(id, {
        status: "tracked",
        workOrderId,
        notes: body.notes ?? existing.notes,
        scheduledDate: body.scheduledDate ?? existing.scheduledDate,
        parsed: body.parsed ? { ...existing.parsed, ...body.parsed } : existing.parsed,
        mhelpdeskPush: {
          status: existing.mhelpdeskPush?.status ?? "needs_connection",
          fieldMap: buildMhelpdeskFieldMap({
            ...existing,
            notes: body.notes ?? existing.notes,
            scheduledDate: body.scheduledDate ?? existing.scheduledDate,
            parsed: body.parsed ? { ...existing.parsed, ...body.parsed } : existing.parsed,
          }),
          updatedAt: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        ok: true,
        record: updated,
        workOrderDraft: draft,
        trackerLink: workOrderId.startsWith("local-") ? `/job-intake?id=${id}` : `/work-orders/${workOrderId}`,
      });
    }

    const updated = await updateJobIntakeRecord(id, {
      status: body.status,
      notes: body.notes,
      scheduledDate: body.scheduledDate,
      photoUrls: body.photoUrls,
      parsed: body.parsed,
      emailDraft: body.emailDraft
        ? {
            ...(existing.emailDraft ?? buildDefaultEmailDraft(existing)),
            ...body.emailDraft,
            updatedAt: new Date().toISOString(),
          }
        : undefined,
    });

    return NextResponse.json({ ok: true, record: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update job intake." },
      { status: 400 }
    );
  }
}
