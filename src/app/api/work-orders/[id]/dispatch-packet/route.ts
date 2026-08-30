import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { buildFortifiedDispatchPacket, buildSubcontractorEmail } from "@/lib/dispatch/packet";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase } = await requireStaff();
  const { data: wo } = await supabase
    .from("work_orders")
    .select(
      `*,
      customers ( company_name ),
      locations ( location_name, address_line_1, city, state, zip, access_instructions, site_contact_name, site_contact_phone ),
      subcontractors ( company_name, email )`
    )
    .eq("id", id)
    .maybeSingle();

  if (!wo) return NextResponse.json({ ok: false, error: "Work order not found." }, { status: 404 });

  const customer = unwrapEmbed<{ company_name: string }>(wo.customers);
  const location = unwrapEmbed<{
    location_name: string;
    address_line_1: string;
    city: string;
    state: string;
    zip: string | null;
    access_instructions: string | null;
    site_contact_name: string | null;
    site_contact_phone: string | null;
  }>(wo.locations);
  const sub = unwrapEmbed<{ company_name: string; email: string | null }>(wo.subcontractors);

  const packetInput = {
    workOrderNumber: wo.work_order_number,
    title: wo.title,
    status: wo.status,
    priority: wo.priority,
    tradeType: wo.trade_type,
    scope: wo.scope_summary,
    customerName: customer?.company_name,
    customerWorkOrderNumber: wo.customer_work_order_number,
    purchaseOrderNumber: wo.purchase_order_number,
    nte: wo.not_to_exceed_amount,
    locationName: location?.location_name,
    address: location?.address_line_1,
    city: location?.city,
    state: location?.state,
    zip: location?.zip,
    accessInstructions: location?.access_instructions,
    scheduledDate: wo.scheduled_date,
    dueDate: wo.due_date,
    requestedDate: wo.requested_date,
    siteContactName: location?.site_contact_name,
    siteContactPhone: location?.site_contact_phone,
    subcontractorName: sub?.company_name,
    customerNotes: wo.customer_notes,
    internalNotes: wo.internal_notes,
  };

  const packet = buildFortifiedDispatchPacket(packetInput);
  const email = buildSubcontractorEmail(packetInput);

  return NextResponse.json({
    ok: true,
    packet,
    email: { ...email, to: sub?.email ?? "" },
    filename: `${wo.work_order_number}-fortified-dispatch.txt`,
  });
}
