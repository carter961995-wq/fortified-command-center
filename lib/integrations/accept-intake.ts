import { intakeToWorkOrderDraft, getJobIntakeRecord, updateJobIntakeRecord, buildMhelpdeskFieldMap, type JobIntakeRecord } from "./job-intake.ts";
import { withFileLock } from "../file-lock.ts";

type DataClient = { from: (table: string) => any };

const inflight = new Map<string, Promise<AcceptIntakeResult>>();

export type AcceptIntakeResult = {
  record: JobIntakeRecord;
  workOrderId: string;
  trackerLink: string;
  created: boolean;
};

async function dataClient(): Promise<DataClient> {
  try {
    const { createSupabaseServerClient } = await import("../supabase/server.ts");
    const client = await createSupabaseServerClient();
    if (client) return client;
  } catch {
    /* Tests and scripts run outside a Next request. */
  }
  const { createLocalDataClient } = await import("../../src/lib/demo-client.ts");
  return createLocalDataClient({ seed: false });
}

function realWorkOrderId(value: string | null | undefined) {
  if (!value || value.startsWith("local-")) return null;
  return value;
}

async function insertWorkOrder(client: DataClient, record: JobIntakeRecord) {
  const draft = intakeToWorkOrderDraft(record);
  const inserted = await client
    .from("work_orders")
    .insert({
      title: draft.title,
      scope_summary: draft.scope_summary,
      trade_type: draft.trade_type,
      priority: draft.priority,
      status: "New",
      source: draft.source,
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
  if (inserted?.error || !inserted?.data?.id) {
    throw new Error(inserted?.error?.message || "Work order was not created.");
  }
  const id = String(inserted.data.id);
  const check = await client.from("work_orders").select("id").eq("id", id).maybeSingle();
  if (check?.error || !check?.data?.id) {
    throw new Error("Work order was not created.");
  }
  return id;
}

async function acceptLocked(id: string, patch: { notes?: string; scheduledDate?: string | null; parsed?: JobIntakeRecord["parsed"] }): Promise<AcceptIntakeResult> {
  return withFileLock(`accept-${id}`, async () => {
    const existing = await getJobIntakeRecord(id);
    if (!existing) throw new Error("Not found.");
    const record: JobIntakeRecord = {
      ...existing,
      notes: patch.notes ?? existing.notes,
      scheduledDate: patch.scheduledDate ?? existing.scheduledDate,
      parsed: patch.parsed ? { ...existing.parsed, ...patch.parsed } : existing.parsed,
    };
    const already = realWorkOrderId(record.workOrderId);
    if (already) {
      return {
        record,
        workOrderId: already,
        trackerLink: `/work-orders/${already}`,
        created: false,
      };
    }

    const client = await dataClient();
    let workOrderId: string;
    try {
      workOrderId = await insertWorkOrder(client, record);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Work order was not created.");
    }

    const updated = await updateJobIntakeRecord(id, {
      status: "tracked",
      workOrderId,
      notes: record.notes,
      scheduledDate: record.scheduledDate,
      parsed: record.parsed,
      mhelpdeskPush: {
        status: existing.mhelpdeskPush?.status ?? "needs_connection",
        fieldMap: buildMhelpdeskFieldMap(record),
        updatedAt: new Date().toISOString(),
      },
    });
    if (!updated) throw new Error("Work order was created but the intake record could not be linked.");
    return {
      record: updated,
      workOrderId,
      trackerLink: `/work-orders/${workOrderId}`,
      created: true,
    };
  });
}

export async function acceptJobIntake(
  id: string,
  patch: { notes?: string; scheduledDate?: string | null; parsed?: JobIntakeRecord["parsed"] } = {}
) {
  const current = inflight.get(id);
  if (current) return current;
  const promise = acceptLocked(id, patch).finally(() => {
    inflight.delete(id);
  });
  inflight.set(id, promise);
  return promise;
}
