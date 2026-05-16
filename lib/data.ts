import { moduleMap, modules, type ModuleDefinition } from "@/lib/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateProfit, type PlainRow } from "@/lib/business";

export type QueryResult<T> = { data: T; error?: string };

export async function getSessionContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null, profile: null, error: "Supabase environment variables are not configured." };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) return { supabase, user: null, profile: null, error: userError?.message ?? "Not authenticated." };

  const { data: profile } = await supabase.from("users_profile").select("*").eq("auth_user_id", user.id).maybeSingle();
  return { supabase, user, profile: (profile ?? null) as PlainRow | null, error: undefined };
}

export async function fetchModuleRows(def: ModuleDefinition): Promise<QueryResult<PlainRow[]>> {
  const { supabase, error } = await getSessionContext();
  if (!supabase) return { data: [], error };

  const { data, error: queryError } = await supabase.from(def.table).select(def.select).order("created_at", { ascending: false }).limit(250);
  return { data: ((data ?? []) as unknown) as PlainRow[], error: queryError?.message };
}

export async function fetchModuleRecord(def: ModuleDefinition, id: string): Promise<QueryResult<PlainRow | null>> {
  const { supabase, error } = await getSessionContext();
  if (!supabase) return { data: null, error };

  const { data, error: queryError } = await supabase.from(def.table).select(def.select).eq("id", id).maybeSingle();
  return { data: (data ?? null) as PlainRow | null, error: queryError?.message };
}

export async function fetchRelationOptions(fields: ModuleDefinition["fields"]) {
  const { supabase } = await getSessionContext();
  const relationFields = fields.filter((field) => field.type === "relation" && field.relation);
  if (!supabase || relationFields.length === 0) return {} as Record<string, { value: string; label: string }[]>;

  const entries = await Promise.all(
    relationFields.map(async (field) => {
      const relation = field.relation!;
      const { data } = await supabase
        .from(relation.table)
        .select([relation.value, relation.label].join(","))
        .order(relation.orderBy ?? relation.label, { ascending: true })
        .limit(500);
      const options = (((data ?? []) as unknown) as PlainRow[]).map((row) => ({
        value: String(row[relation.value]),
        label: String(row[relation.label] ?? row[relation.value])
      }));
      return [field.name, options] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function fetchWorkOrderRelated(id: string) {
  const { supabase } = await getSessionContext();
  if (!supabase) return { photos: [], documents: [], quotes: [], invoices: [], jobCosts: [], profit: calculateProfit(0, 0) };

  const [photos, documents, quotes, invoices, jobCosts] = await Promise.all([
    supabase.from("work_order_photos").select("*").eq("work_order_id", id).order("created_at", { ascending: false }),
    supabase.from("work_order_documents").select("*").eq("work_order_id", id).order("created_at", { ascending: false }),
    supabase.from("quotes").select("*").eq("work_order_id", id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("work_order_id", id).order("created_at", { ascending: false }),
    supabase.from("job_costs").select("*").eq("work_order_id", id).order("created_at", { ascending: false })
  ]);

  const invoiceTotal = ((invoices.data ?? []) as PlainRow[]).reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const costTotal = ((jobCosts.data ?? []) as PlainRow[]).reduce((sum, cost) => sum + Number(cost.amount ?? 0), 0);

  return {
    photos: (photos.data ?? []) as PlainRow[],
    documents: (documents.data ?? []) as PlainRow[],
    quotes: (quotes.data ?? []) as PlainRow[],
    invoices: (invoices.data ?? []) as PlainRow[],
    jobCosts: (jobCosts.data ?? []) as PlainRow[],
    profit: calculateProfit(invoiceTotal, costTotal)
  };
}

export async function fetchInvoiceRelated(id: string) {
  const { supabase } = await getSessionContext();
  if (!supabase) return { lineItems: [], payments: [] };
  const [lineItems, payments] = await Promise.all([
    supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("created_at", { ascending: true }),
    supabase.from("payments").select("*").eq("invoice_id", id).order("payment_date", { ascending: false })
  ]);
  return { lineItems: (lineItems.data ?? []) as PlainRow[], payments: (payments.data ?? []) as PlainRow[] };
}

export async function fetchMaintenanceVisits(id: string) {
  const { supabase } = await getSessionContext();
  if (!supabase) return [] as PlainRow[];
  const { data } = await supabase.from("maintenance_visits").select("*, work_orders(work_order_number, title)").eq("maintenance_contract_id", id).order("scheduled_date", { ascending: true });
  return (data ?? []) as PlainRow[];
}

export async function fetchDashboardMetrics() {
  const { supabase, error } = await getSessionContext();
  if (!supabase) return { error, metrics: {}, recentWorkOrders: [], upcomingJobs: [], invoiceAttention: [] };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [workOrders, invoices, costs, subcontractors, contracts] = await Promise.all([
    supabase.from("work_orders").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("invoices").select("*").order("due_date", { ascending: true }).limit(500),
    supabase.from("job_costs").select("*, work_orders!inner(completed_date)").gte("work_orders.completed_date", startOfMonth.toISOString().slice(0, 10)),
    supabase.from("subcontractors").select("id,status").eq("status", "active"),
    supabase.from("maintenance_contracts").select("id,status").eq("status", "active")
  ]);

  const wo = (workOrders.data ?? []) as PlainRow[];
  const inv = (invoices.data ?? []) as PlainRow[];
  const monthInvoices = inv.filter((invoice) => String(invoice.invoice_date ?? "") >= startOfMonth.toISOString().slice(0, 10));
  const revenueThisMonth = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const costsThisMonth = ((costs.data ?? []) as PlainRow[]).reduce((sum, cost) => sum + Number(cost.amount ?? 0), 0);
  const profit = calculateProfit(revenueThisMonth, costsThisMonth);

  return {
    error: undefined,
    metrics: {
      openWorkOrders: wo.filter((row) => !["Closed", "Cancelled"].includes(String(row.status))).length,
      jobsNeedingQuotes: wo.filter((row) => row.status === "Quote Needed").length,
      waitingOnSubQuote: wo.filter((row) => row.status === "Waiting on Sub Quote").length,
      readyToInvoice: wo.filter((row) => row.status === "Ready to Invoice").length,
      unpaidInvoices: inv.filter((row) => Number(row.balance_due ?? 0) > 0).length,
      overdueInvoices: inv.filter((row) => row.status === "overdue" || (row.due_date && new Date(String(row.due_date)) < new Date() && Number(row.balance_due ?? 0) > 0)).length,
      revenueThisMonth,
      grossProfitThisMonth: profit.grossProfit,
      grossMarginThisMonth: profit.grossMargin,
      activeSubcontractors: (subcontractors.data ?? []).length,
      activeMaintenanceContracts: (contracts.data ?? []).length
    },
    recentWorkOrders: wo.slice(0, 8),
    upcomingJobs: wo.filter((row) => row.scheduled_date && !["Closed", "Cancelled"].includes(String(row.status))).slice(0, 8),
    invoiceAttention: inv.filter((row) => Number(row.balance_due ?? 0) > 0).slice(0, 8)
  };
}

export async function fetchReports() {
  const { supabase, error } = await getSessionContext();
  if (!supabase) return { error, invoices: [], costs: [], workOrders: [], customers: [], subcontractors: [] };
  const [invoices, costs, workOrders, customers, subcontractors] = await Promise.all([
    supabase.from("invoices").select("*, customers(company_name), locations(state)").order("invoice_date", { ascending: false }).limit(1000),
    supabase.from("job_costs").select("*, work_orders(customer_id, subcontractor_id, locations(state)), subcontractors(company_name)").limit(1000),
    supabase.from("work_orders").select("*, customers(company_name), locations(state), subcontractors(company_name)").limit(1000),
    supabase.from("customers").select("id, company_name").limit(1000),
    supabase.from("subcontractors").select("id, company_name, callback_count, jobs_completed").limit(1000)
  ]);
  return {
    error: undefined,
    invoices: (invoices.data ?? []) as PlainRow[],
    costs: (costs.data ?? []) as PlainRow[],
    workOrders: (workOrders.data ?? []) as PlainRow[],
    customers: (customers.data ?? []) as PlainRow[],
    subcontractors: (subcontractors.data ?? []) as PlainRow[]
  };
}

export function moduleForSlug(slug: string) {
  return moduleMap[slug];
}

export function allModules() {
  return modules;
}
