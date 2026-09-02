import { Suspense } from "react";
import { requireStaff } from "@/lib/require-staff";
import { CommandDashboard } from "@/components/command-dashboard";
import { PremiumDashboardFallback, type DashboardInvoice, type DashboardWorkOrder } from "@/components/premium-dashboard";
import { loadMhelpdeskConnection } from "../../../../lib/integrations/mhelpdesk";
import { loadTruesourceConnection } from "../../../../lib/integrations/truesource";
import { loadGoogleConnection } from "../../../../lib/integrations/google";
import { endOfMonth, format, startOfMonth } from "date-fns";

export const metadata = {
  title: "Dashboard",
};

async function DashboardContent() {
  const { supabase } = await requireStaff();

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [
    openWo,
    needQuotes,
    waitSub,
    readyInv,
    urgentWo,
    productionWo,
    callbackWo,
    unpaidInv,
    overdueInv,
    monthInvoices,
    activeSubs,
    activeContracts,
    recentWo,
    scheduledWo,
    attentionInvoices,
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .not("status", "eq", "Closed")
      .not("status", "eq", "Cancelled"),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["Quote Needed", "Needs Site Info"]),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "Waiting on Sub Quote"),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "Ready to Invoice"),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("priority", "Urgent")
      .not("status", "eq", "Closed")
      .not("status", "eq", "Cancelled"),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["Approved", "Scheduled", "In Progress", "Completed by Sub", "Needs Review"]),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "Callback/Warranty"),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "partially_paid", "overdue"]),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .lt("due_date", today)
      .gt("balance_due", 0)
      .not("status", "eq", "paid")
      .not("status", "eq", "void")
      .not("status", "eq", "draft"),
    supabase
      .from("invoices")
      .select("work_order_id, total_amount, status")
      .gte("invoice_date", monthStart)
      .lte("invoice_date", monthEnd)
      .not("status", "eq", "void")
      .not("status", "eq", "draft"),
    supabase.from("subcontractors").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("maintenance_contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("work_orders")
      .select(
        "id, work_order_number, title, status, priority, scheduled_date, customers(company_name), locations(city, state)"
      )
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("work_orders")
      .select(
        "id, work_order_number, title, status, scheduled_date, customers(company_name), locations(city, state)"
      )
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", today)
      .order("scheduled_date", { ascending: true })
      .limit(12),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, total_amount, balance_due, due_date, customers(company_name)"
      )
      .gt("balance_due", 0)
      .not("status", "eq", "paid")
      .not("status", "eq", "void")
      .not("status", "eq", "draft")
      .order("due_date", { ascending: true })
      .limit(12),
  ]);

  const woIds = Array.from(
    new Set((monthInvoices.data ?? []).map((i) => i.work_order_id).filter(Boolean))
  ) as string[];

  let revenueMonth = 0;
  let grossProfitMonth = 0;
  for (const inv of monthInvoices.data ?? []) {
    revenueMonth += Number(inv.total_amount ?? 0);
  }

  if (woIds.length) {
    const { data: fin } = await supabase.from("work_order_financials").select("*").in("work_order_id", woIds);
    const finByWo = new Map((fin ?? []).map((f) => [f.work_order_id, f]));
    const profitCounted = new Set<string>();
    for (const inv of monthInvoices.data ?? []) {
      const woid = inv.work_order_id as string | null;
      if (!woid || profitCounted.has(woid)) continue;
      profitCounted.add(woid);
      grossProfitMonth += Number(finByWo.get(woid)?.gross_profit ?? 0);
    }
  }

  const margin =
    revenueMonth > 0 ? Math.round((grossProfitMonth / revenueMonth) * 10000) / 100 : 0;

  const [mhelpdesk, truesource, gmail] = await Promise.all([
    loadMhelpdeskConnection(),
    loadTruesourceConnection(),
    loadGoogleConnection(),
  ]);

  return (
    <CommandDashboard
      metrics={{
        openWorkOrders: openWo.count ?? 0,
        needQuotes: needQuotes.count ?? 0,
        waitingOnSubQuote: waitSub.count ?? 0,
        readyToInvoice: readyInv.count ?? 0,
        unpaidInvoices: unpaidInv.count ?? 0,
        overdueInvoices: overdueInv.count ?? 0,
        revenueMonth,
        grossProfitMonth,
        margin,
        activeSubcontractors: activeSubs.count ?? 0,
        activeMaintenance: activeContracts.count ?? 0,
        urgentWorkOrders: urgentWo.count ?? 0,
        productionWorkOrders: productionWo.count ?? 0,
        callbackWorkOrders: callbackWo.count ?? 0,
        monthLabel: `${format(startOfMonth(new Date()), "MMM d")} - ${format(endOfMonth(new Date()), "MMM d")}`,
      }}
      recentWorkOrders={(recentWo.data ?? []) as DashboardWorkOrder[]}
      scheduledWorkOrders={(scheduledWo.data ?? []) as DashboardWorkOrder[]}
      attentionInvoices={(attentionInvoices.data ?? []) as DashboardInvoice[]}
      sources={{
        mhelpdesk: { connected: Boolean(mhelpdesk), email: mhelpdesk?.email, lastSyncAt: mhelpdesk?.lastSyncAt },
        truesource: { connected: Boolean(truesource), email: truesource?.email, lastSyncAt: truesource?.lastSyncAt },
        gmail: { connected: Boolean(gmail), email: gmail?.email },
      }}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PremiumDashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}
