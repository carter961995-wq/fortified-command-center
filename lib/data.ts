import { businessToday, calculateProfit, calendarDate, endOfBusinessWeek, startOfBusinessWeek, type PlainRow } from "./business";
import { moduleMap, modules, type ModuleDefinition } from "./schema";
import { createSupabaseServerClient } from "./supabase/server";

export const MODULE_PAGE_SIZE = 50;

export type ModulePageQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
};

export type ModulePage = {
  rows: PlainRow[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

export type QueryResult<T> = { data: T; error?: string };

export async function getSessionContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null, profile: { full_name: "Operator", email: "" }, error: undefined };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) return { supabase, user: null, profile: null, error: userError?.message ?? "Not authenticated." };

  const { data: profile } = await supabase.from("users_profile").select("*").eq("auth_user_id", user.id).maybeSingle();
  return { supabase, user, profile: (profile ?? null) as PlainRow | null, error: undefined };
}

function searchableColumns(def: ModuleDefinition) {
  return Array.from(
    new Set([...def.fields.map((field) => field.name), ...def.listColumns.map((column) => column.key), def.primaryField])
  ).filter((name) => name && !name.includes(".") && !name.endsWith("_id"));
}

function searchTerm(query: string) {
  return query.replace(/[%_,.()"'\\]/g, " ").replace(/\s+/g, " ").trim();
}

function applyModuleFilters(query: any, def: ModuleDefinition, options?: { q?: string; status?: string }) {
  let next = query;
  if (options?.status && def.statusField) next = next.eq(def.statusField, options.status);
  const term = options?.q ? searchTerm(options.q) : "";
  if (term) {
    const filters = searchableColumns(def).map((column) => `${column}.ilike.%${term}%`);
    if (filters.length) next = next.or(filters.join(","));
  }
  return next;
}

export async function fetchModulePage(def: ModuleDefinition, options: ModulePageQuery = {}): Promise<ModulePage> {
  const pageSize = Math.min(100, Math.max(1, options.pageSize || MODULE_PAGE_SIZE));
  const page = Math.max(1, options.page || 1);
  const { supabase, error } = await getSessionContext();
  if (!supabase) return { rows: [], total: 0, page, pageSize, error };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let request = supabase.from(def.table).select(def.select, { count: "exact" });
  request = applyModuleFilters(request, def, options);
  const { data, error: queryError, count } = await request
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  return {
    rows: ((data ?? []) as unknown) as PlainRow[],
    total: Number(count ?? 0),
    page,
    pageSize,
    error: queryError?.message,
  };
}

export async function fetchModuleRows(def: ModuleDefinition): Promise<QueryResult<PlainRow[]>> {
  const pageSize = 100;
  const rows: PlainRow[] = [];
  let page = 1;
  let total = 0;
  let error: string | undefined;
  do {
    const result = await fetchModulePage(def, { page, pageSize });
    error = result.error;
    total = result.total;
    rows.push(...result.rows);
    if (result.rows.length === 0) break;
    page += 1;
  } while (rows.length < total && page < 100);
  return { data: rows, error };
}

export async function searchRelationOptions(
  relation: { table: string; value: string; label: string; orderBy?: string },
  query = "",
  selectedId?: string
) {
  const { supabase } = await getSessionContext();
  if (!supabase) return [] as { value: string; label: string }[];
  const term = searchTerm(query);
  let request = supabase
    .from(relation.table)
    .select([relation.value, relation.label].join(","))
    .order(relation.orderBy ?? relation.label, { ascending: true })
    .order(relation.value, { ascending: true })
    .range(0, 24);
  if (term) request = request.ilike(relation.label, `%${term}%`);
  const { data } = await request;
  const options = (((data ?? []) as unknown) as PlainRow[]).map((row) => ({
    value: String(row[relation.value]),
    label: String(row[relation.label] ?? row[relation.value]),
  }));
  if (selectedId && !options.some((option) => option.value === selectedId)) {
    const { data: selected } = await supabase
      .from(relation.table)
      .select([relation.value, relation.label].join(","))
      .eq(relation.value, selectedId)
      .maybeSingle();
    if (selected) {
      const row = selected as unknown as PlainRow;
      options.unshift({ value: String(row[relation.value]), label: String(row[relation.label] ?? row[relation.value]) });
    }
  }
  return options;
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
        .order(relation.value, { ascending: true })
        .range(0, 49);
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

const CLOSED_JOBS = "(Closed,Cancelled)";

async function exactCount(supabase: any, table: string, apply?: (query: any) => any) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return Number(count ?? 0);
}

async function sumColumn(supabase: any, table: string, column: string, apply?: (query: any) => any) {
  const size = 500;
  let from = 0;
  let total = 0;
  for (;;) {
    let query = supabase.from(table).select(column).order("id", { ascending: true }).range(from, from + size - 1);
    if (apply) query = apply(query);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PlainRow[];
    for (const row of rows) total += Number(row[column] ?? 0);
    if (rows.length < size) break;
    from += size;
  }
  return Math.round(total * 100) / 100;
}

export async function fetchDashboardMetrics() {
  const { supabase, error } = await getSessionContext();
  if (!supabase) return { error, metrics: {}, recentWorkOrders: [], upcomingJobs: [], invoiceAttention: [] };

  const today = businessToday();
  const monthStart = `${today.slice(0, 8)}01`;

  try {
    const [
      openWorkOrders,
      jobsNeedingQuotes,
      waitingOnSubQuote,
      readyToInvoice,
      unpaidInvoices,
      overdueInvoices,
      revenueThisMonth,
      costsThisMonth,
      activeSubcontractors,
      activeMaintenanceContracts,
      recent,
      upcoming,
      attention,
    ] = await Promise.all([
      exactCount(supabase, "work_orders", (query) => query.not("status", "in", CLOSED_JOBS)),
      exactCount(supabase, "work_orders", (query) => query.eq("status", "Quote Needed")),
      exactCount(supabase, "work_orders", (query) => query.eq("status", "Waiting on Sub Quote")),
      exactCount(supabase, "work_orders", (query) => query.eq("status", "Ready to Invoice")),
      exactCount(supabase, "invoices", (query) => query.gt("balance_due", 0)),
      exactCount(supabase, "invoices", (query) => query.gt("balance_due", 0).lt("due_date", today)),
      sumColumn(supabase, "invoices", "total_amount", (query) => query.gte("invoice_date", monthStart)),
      sumColumn(supabase, "job_costs", "amount", (query) => query.gte("created_at", `${monthStart}T00:00:00.000Z`)),
      exactCount(supabase, "subcontractors", (query) => query.eq("status", "active")),
      exactCount(supabase, "maintenance_contracts", (query) => query.eq("status", "active")),
      supabase.from("work_orders").select("id, title, work_order_number, status, created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 7),
      supabase.from("work_orders").select("id, title, scheduled_date, status").gte("scheduled_date", today).not("status", "in", CLOSED_JOBS).order("scheduled_date", { ascending: true }).order("id", { ascending: true }).range(0, 7),
      supabase.from("invoices").select("id, invoice_number, balance_due, due_date, status").gt("balance_due", 0).order("due_date", { ascending: true }).order("id", { ascending: true }).range(0, 7),
    ]);
    const profit = calculateProfit(revenueThisMonth, costsThisMonth);
    return {
      error: undefined,
      metrics: {
        openWorkOrders,
        jobsNeedingQuotes,
        waitingOnSubQuote,
        readyToInvoice,
        unpaidInvoices,
        overdueInvoices,
        revenueThisMonth,
        grossProfitThisMonth: profit.grossProfit,
        grossMarginThisMonth: profit.grossMargin,
        activeSubcontractors,
        activeMaintenanceContracts,
      },
      recentWorkOrders: ((recent.data ?? []) as unknown) as PlainRow[],
      upcomingJobs: ((upcoming.data ?? []) as unknown) as PlainRow[],
      invoiceAttention: ((attention.data ?? []) as unknown) as PlainRow[],
    };
  } catch (failure) {
    return {
      error: failure instanceof Error ? failure.message : "Could not load dashboard totals.",
      metrics: {},
      recentWorkOrders: [],
      upcomingJobs: [],
      invoiceAttention: [],
    };
  }
}

export type ReportRow = { label: string; revenue: number; cost: number; count: number };

async function eachPage(supabase: any, table: string, columns: string, apply: (query: any) => any, visit: (row: PlainRow) => void) {
  const size = 500;
  let from = 0;
  for (;;) {
    const { data, error } = await apply(supabase.from(table).select(columns).order("id", { ascending: true }).range(from, from + size - 1));
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PlainRow[];
    rows.forEach(visit);
    if (rows.length < size) break;
    from += size;
  }
}

export async function fetchReports() {
  const { supabase, error } = await getSessionContext();
  if (!supabase) {
    return { error, byMonth: [], byCustomer: [], byState: [], bySub: [], aging: [], callbacks: [] as ReportRow[] };
  }
  try {
    const costByWorkOrder = new Map<string, number>();
    await eachPage(supabase, "job_costs", "id, work_order_id, amount", (query) => query, (cost) => {
      const id = String(cost.work_order_id ?? "");
      costByWorkOrder.set(id, (costByWorkOrder.get(id) ?? 0) + Number(cost.amount ?? 0));
    });

    const byMonth = new Map<string, ReportRow>();
    const byCustomer = new Map<string, ReportRow>();
    const byState = new Map<string, ReportRow>();
    const add = (map: Map<string, ReportRow>, label: string, revenue = 0, cost = 0, count = 0) => {
      const current = map.get(label) ?? { label, revenue: 0, cost: 0, count: 0 };
      current.revenue += revenue;
      current.cost += cost;
      current.count += count;
      map.set(label, current);
    };

    await eachPage(
      supabase,
      "invoices",
      "id, invoice_number, invoice_date, total_amount, balance_due, work_order_id, customers(company_name), locations(state)",
      (query) => query,
      (invoice) => {
        const revenue = Number(invoice.total_amount ?? 0);
        const cost = costByWorkOrder.get(String(invoice.work_order_id ?? "")) ?? 0;
        const date = calendarDate(invoice.invoice_date) ?? "Unscheduled";
        add(byMonth, date.slice(0, 7), revenue, cost, 1);
        const customer = invoice.customers as PlainRow | PlainRow[] | null;
        const customerName = Array.isArray(customer) ? customer[0]?.company_name : customer?.company_name;
        const location = invoice.locations as PlainRow | PlainRow[] | null;
        const state = Array.isArray(location) ? location[0]?.state : location?.state;
        add(byCustomer, String(customerName || "Unknown"), revenue, cost, 1);
        add(byState, String(state || "Unknown"), revenue, cost, 1);
      }
    );

    const bySub = new Map<string, ReportRow>();
    await eachPage(
      supabase,
      "work_orders",
      "id, status, subcontractors(company_name)",
      (query) => query,
      (workOrder) => {
        const sub = workOrder.subcontractors as PlainRow | PlainRow[] | null;
        const name = Array.isArray(sub) ? sub[0]?.company_name : sub?.company_name;
        const closed = workOrder.status === "Closed" || workOrder.status === "Paid";
        add(bySub, String(name || "Unassigned"), 0, costByWorkOrder.get(String(workOrder.id)) ?? 0, closed ? 1 : 0);
      }
    );

    const aging: ReportRow[] = [];
    await eachPage(
      supabase,
      "invoices",
      "id, invoice_number, balance_due, customers(company_name)",
      (query) => query.gt("balance_due", 0),
      (invoice) => {
        const customer = invoice.customers as PlainRow | PlainRow[] | null;
        const customerName = Array.isArray(customer) ? customer[0]?.company_name : customer?.company_name;
        aging.push({
          label: `${invoice.invoice_number ?? "Invoice"} · ${customerName ?? "Customer"}`,
          revenue: Number(invoice.balance_due ?? 0),
          cost: 0,
          count: 1,
        });
      }
    );

    const callbacks: ReportRow[] = [];
    await eachPage(supabase, "subcontractors", "id, company_name, callback_count, jobs_completed", (query) => query, (sub) => {
      callbacks.push({
        label: String(sub.company_name ?? "Subcontractor"),
        revenue: 0,
        cost: Number(sub.callback_count ?? 0),
        count: Number(sub.jobs_completed ?? 0),
      });
    });

    const rows = (map: Map<string, ReportRow>) => Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label));
    return {
      error: undefined,
      byMonth: rows(byMonth),
      byCustomer: rows(byCustomer),
      byState: rows(byState),
      bySub: rows(bySub),
      aging: aging.sort((a, b) => b.revenue - a.revenue),
      callbacks,
    };
  } catch (failure) {
    return {
      error: failure instanceof Error ? failure.message : "Could not build reports.",
      byMonth: [],
      byCustomer: [],
      byState: [],
      bySub: [],
      aging: [],
      callbacks: [],
    };
  }
}

export async function fetchInvoiceSummary() {
  const { supabase, error } = await getSessionContext();
  if (!supabase) return { error, openCount: 0, outstanding: 0, tracked: 0, recent: [] as PlainRow[] };
  try {
    const [openCount, tracked, outstanding, recent] = await Promise.all([
      exactCount(supabase, "invoices", (query) => query.gt("balance_due", 0)),
      exactCount(supabase, "invoices"),
      sumColumn(supabase, "invoices", "balance_due", (query) => query.gt("balance_due", 0)),
      supabase.from("invoices").select("id, invoice_number, balance_due, customers(company_name)").order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 19),
    ]);
    return { error: recent.error?.message, openCount, outstanding, tracked, recent: ((recent.data ?? []) as unknown) as PlainRow[] };
  } catch (failure) {
    return { error: failure instanceof Error ? failure.message : "Could not total invoices.", openCount: 0, outstanding: 0, tracked: 0, recent: [] as PlainRow[] };
  }
}

export async function fetchDocumentLibrary(query = "") {
  const { supabase, error } = await getSessionContext();
  if (!supabase) return { error, documents: [] as PlainRow[], photos: [] as PlainRow[] };
  const term = searchTerm(query);
  let documents = supabase.from("work_order_documents").select("id, filename, document_type, document_url, work_order_id, created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 49);
  let photos = supabase.from("work_order_photos").select("id, caption, photo_type, photo_url, work_order_id, created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 49);
  if (term) {
    documents = documents.or(`filename.ilike.%${term}%,document_type.ilike.%${term}%`);
    photos = photos.or(`caption.ilike.%${term}%,photo_type.ilike.%${term}%`);
  }
  const [documentResult, photoResult] = await Promise.all([documents, photos]);
  return {
    error: documentResult.error?.message || photoResult.error?.message,
    documents: ((documentResult.data ?? []) as unknown) as PlainRow[],
    photos: ((photoResult.data ?? []) as unknown) as PlainRow[],
  };
}

export async function fetchPlannerColumns() {
  const { supabase, error } = await getSessionContext();
  const today = businessToday();
  const weekStart = startOfBusinessWeek(today);
  const weekEnd = endOfBusinessWeek(today);
  const empty = { today: [] as PlainRow[], week: [] as PlainRow[], upcoming: [] as PlainRow[], unscheduled: [] as PlainRow[], counts: { today: 0, week: 0, upcoming: 0, unscheduled: 0 } };
  if (!supabase) return { error, ...empty };
  try {
  const columns = "id, title, work_order_number, status, scheduled_date";
  const open = (query: any) => query.not("status", "in", CLOSED_JOBS);
  const [todayRows, weekRows, upcomingRows, unscheduledRows, todayCount, weekCount, upcomingCount, unscheduledCount] = await Promise.all([
    open(supabase.from("work_orders").select(columns).eq("scheduled_date", today)).order("id", { ascending: true }).range(0, 39),
    open(supabase.from("work_orders").select(columns).gte("scheduled_date", weekStart).lte("scheduled_date", weekEnd).neq("scheduled_date", today)).order("scheduled_date", { ascending: true }).order("id", { ascending: true }).range(0, 39),
    open(supabase.from("work_orders").select(columns).gt("scheduled_date", weekEnd)).order("scheduled_date", { ascending: true }).order("id", { ascending: true }).range(0, 39),
    open(supabase.from("work_orders").select(columns).is("scheduled_date", null)).order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 39),
    exactCount(supabase, "work_orders", (query) => open(query).eq("scheduled_date", today)),
    exactCount(supabase, "work_orders", (query) => open(query).gte("scheduled_date", weekStart).lte("scheduled_date", weekEnd).neq("scheduled_date", today)),
    exactCount(supabase, "work_orders", (query) => open(query).gt("scheduled_date", weekEnd)),
    exactCount(supabase, "work_orders", (query) => open(query).is("scheduled_date", null)),
  ]);
  return {
    error: todayRows.error?.message || weekRows.error?.message || upcomingRows.error?.message || unscheduledRows.error?.message,
    today: (todayRows.data ?? []) as PlainRow[],
    week: (weekRows.data ?? []) as PlainRow[],
    upcoming: (upcomingRows.data ?? []) as PlainRow[],
    unscheduled: (unscheduledRows.data ?? []) as PlainRow[],
    counts: { today: todayCount, week: weekCount, upcoming: upcomingCount, unscheduled: unscheduledCount },
  };
  } catch (failure) {
    return { error: failure instanceof Error ? failure.message : "Could not load the planner.", ...empty };
  }
}

export function moduleForSlug(slug: string) {
  if (slug === "clients") return moduleMap.customers;
  if (slug === "jobs") return moduleMap["work-orders"];
  return moduleMap[slug];
}

export function allModules() {
  return modules;
}
