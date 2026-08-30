import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { runCompanyAgent, type AgentMessage } from "@/lib/ai/company-agent";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireStaff();
    const body = (await request.json()) as { messages?: AgentMessage[] };
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    if (!messages.length) {
      return NextResponse.json({ ok: false, error: "messages are required." }, { status: 400 });
    }

    const [{ data: workOrders }, { data: invoices }, { data: subcontractors }] = await Promise.all([
      supabase
        .from("work_orders")
        .select("id, work_order_number, title, status, priority, trade_type, scheduled_date, customers(company_name), locations(city, state), subcontractors(company_name)")
        .not("status", "eq", "Closed")
        .not("status", "eq", "Cancelled")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("invoices")
        .select("invoice_number, status, balance_due, customers(company_name)")
        .gt("balance_due", 0)
        .order("due_date", { ascending: true })
        .limit(20),
      supabase.from("subcontractors").select("company_name, city, state, trades").eq("status", "active").limit(30),
    ]);

    const result = await runCompanyAgent(messages, {
      openWorkOrders: (workOrders ?? []).map((wo) => {
        const customer = unwrapEmbed<{ company_name: string }>(wo.customers);
        const location = unwrapEmbed<{ city: string; state: string }>(wo.locations);
        const sub = unwrapEmbed<{ company_name: string }>(wo.subcontractors);
        return {
          id: wo.id,
          work_order_number: wo.work_order_number,
          title: wo.title,
          status: wo.status,
          priority: wo.priority,
          trade_type: wo.trade_type,
          scheduled_date: wo.scheduled_date,
          customer: customer?.company_name ?? null,
          city: location?.city ?? null,
          state: location?.state ?? null,
          subcontractor: sub?.company_name ?? null,
        };
      }),
      invoices: (invoices ?? []).map((inv) => {
        const customer = unwrapEmbed<{ company_name: string }>(inv.customers);
        return {
          invoice_number: inv.invoice_number,
          status: inv.status,
          balance_due: Number(inv.balance_due ?? 0),
          customer: customer?.company_name ?? null,
        };
      }),
      subcontractors: (subcontractors ?? []).map((sub) => ({
        company_name: sub.company_name,
        city: sub.city,
        state: sub.state,
        trades: Array.isArray(sub.trades) ? sub.trades.join(", ") : sub.trades,
      })),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Assistant failed." },
      { status: 400 }
    );
  }
}
