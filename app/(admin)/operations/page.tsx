import Link from "next/link";
import { getSessionContext } from "../../../lib/data";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;
type View = "commitments" | "bids" | "blocked" | "dispatch" | "receivables";
const views: { id: View; label: string }[] = [
  { id: "commitments", label: "Commitments" },
  { id: "bids", label: "Bids & quotes" },
  { id: "blocked", label: "Waiting / blocked" },
  { id: "dispatch", label: "Dispatch" },
  { id: "receivables", label: "Invoiced / paid / owed" },
];
const active = (s: unknown) => !["Closed", "Cancelled", "Paid"].includes(String(s ?? ""));
const dollars = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(v) : "Not recorded";
const relation = (v: unknown): Row => (Array.isArray(v) ? v[0] : v) as Row ?? {};
const text = (v: unknown) => v == null || v === "" ? "Not recorded" : String(v);
function chip(value: string) { return <span className="rounded-full border border-slate-600 px-2 py-1 text-xs">{value}</span>; }
function Card({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return <article className="rounded-xl border border-slate-700 bg-[#14213a] p-4 text-slate-100">
    <Link href={href} className="font-bold text-orange-300 underline-offset-4 hover:underline">{title}</Link>
    <div className="mt-3 grid gap-2 text-sm text-slate-300">{children}</div>
  </article>;
}
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <p><span className="font-semibold text-slate-100">{label}: </span>{value}</p>;
}
function queryString(values: Record<string,string>) {
  const params = new URLSearchParams(Object.entries(values).filter(([,v]) => Boolean(v)));
  return "/operations?" + params.toString();
}
async function loadAll(supabase: any, table: string, columns: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await supabase.from(table).select(columns).order("id").range(offset, offset + 499);
    if (error) throw new Error(table + ": " + error.message);
    const batch = (data ?? []) as Row[];
    all.push(...batch);
    if (batch.length < 500) break;
  }
  return all;
}
export default async function OperationsPage({ searchParams }: {
  searchParams: Promise<{ view?: string; customer?: string; state?: string; type?: string; urgency?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const view: View = views.some(v => v.id === sp.view) ? sp.view as View : "commitments";
  const { supabase } = await getSessionContext();
  if (!supabase) return <div className="p-6"><h1 className="text-2xl font-bold">Operations Board</h1><p>Connect Supabase to view live records. No sample records are presented as confirmed work.</p></div>;
  let jobs: Row[] = [], quotes: Row[] = [], invoices: Row[] = [];
  try {
    [jobs, quotes, invoices] = await Promise.all([
      loadAll(supabase, "work_orders", "*, customers(company_name), locations(location_name, city, state), subcontractors(company_name)"),
      loadAll(supabase, "quotes", "*, customers(company_name), locations(location_name, state), work_orders(work_order_number, title)"),
      loadAll(supabase, "invoices", "*, customers(company_name), locations(location_name, state), work_orders(work_order_number, title)")
    ]);
  } catch (error) {
    return <div className="p-6"><h1 className="text-2xl font-bold">Operations Board</h1><p role="alert">Could not load records: {error instanceof Error ? error.message : "Unknown error"}</p></div>;
  }
  const byId = new Map(jobs.map(j => [String(j.id), j]));
  const customers = [...new Set(jobs.map(j => text(relation(j.customers).company_name)).filter(x => x !== "Not recorded"))].sort();
  const states = [...new Set(jobs.map(j => text(relation(j.locations).state)).filter(x => x !== "Not recorded"))].sort();
  const types = [...new Set(jobs.map(j => text(j.trade_type)).filter(x => x !== "Not recorded"))].sort();
  function match(j: Row) {
    const customer = text(relation(j.customers).company_name);
    const state = text(relation(j.locations).state);
    const trade = text(j.trade_type);
    const search = [j.title,j.work_order_number,j.scope_summary,customer,state].join(" ").toLowerCase();
    return (!sp.customer || sp.customer === customer) && (!sp.state || sp.state === state) &&
      (!sp.type || sp.type === trade) && (!sp.urgency || sp.urgency === j.priority) &&
      (!sp.q || search.includes(sp.q.toLowerCase()));
  }
  const filteredJobs = jobs.filter(match);
  const related = (r: Row) => byId.get(String(r.work_order_id)) ?? r;
  const filteredQuotes = quotes.filter(q => match(related(q)));
  const filteredInvoices = invoices.filter(i => match(related(i)));
  const blockedStatuses = ["Needs Site Info","Waiting on Sub Quote","Quote Needed","Needs Review"];
  const visibleJobs = view === "commitments"
    ? filteredJobs.filter(j => active(j.status) && (j.scheduled_date || j.due_date || j.requested_date))
    : view === "blocked" ? filteredJobs.filter(j => active(j.status) && (blockedStatuses.includes(String(j.status)) || !j.scope_summary || !j.not_to_exceed_amount))
    : view === "dispatch" ? filteredJobs.filter(j => active(j.status) && (j.subcontractor_id || ["Approved","Scheduled","In Progress"].includes(String(j.status))))
    : [];
  const params = { customer: sp.customer ?? "", state: sp.state ?? "", type: sp.type ?? "", urgency: sp.urgency ?? "", q: sp.q ?? "" };
  const owed = filteredInvoices.filter(i => i.status !== "void" && i.status !== "draft").reduce((n,i) => n + Math.max(0, Number(i.balance_due ?? (Number(i.total_amount ?? 0)-Number(i.amount_paid ?? 0)))),0);
  return <main className="grid gap-5 p-2 text-slate-100">
    <header><h1 className="text-3xl font-black">Operations Board</h1><p className="mt-2 text-sm text-slate-300">Live records only. A populated date or approval status is not proof of a confirmed commitment. Verify source documentation before dispatching, billing or promising a date.</p></header>
    <nav className="flex flex-wrap gap-2" aria-label="Operations views">{views.map(v => <Link key={v.id} href={queryString({...params,view:v.id})} aria-current={view === v.id ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === v.id ? "bg-orange-500 text-slate-950" : "bg-[#1a2c48] text-slate-100"}`}>{v.label}</Link>)}</nav>
    <form method="get" className="grid gap-2 rounded-xl border border-slate-700 p-3 sm:grid-cols-3 lg:grid-cols-6">
      <input type="hidden" name="view" value={view}/>
      <input aria-label="Search work orders" name="q" placeholder="Search jobs / WO #" defaultValue={sp.q ?? ""} className="rounded bg-[#182945] p-2"/>
      {([{name:"customer",label:"All customers",options:customers},{name:"state",label:"All states",options:states},{name:"type",label:"All project types",options:types},{name:"urgency",label:"All urgency",options:["low","normal","urgent","emergency"]}] as const).map(f => <select aria-label={f.label} key={f.name} name={f.name} defaultValue={sp[f.name] ?? ""} className="rounded bg-[#182945] p-2"><option value="">{f.label}</option>{f.options.map(v=><option key={v} value={v}>{v}</option>)}</select>)}
      <button className="rounded bg-orange-500 px-3 py-2 font-bold text-slate-950">Apply filters</button>
    </form>
    {view === "receivables" && <p className="rounded-xl border border-slate-700 p-4 font-bold">Recorded open invoice balance: {dollars(owed)} <span className="block text-xs font-normal text-slate-300">Excludes drafts and void invoices. Based on recorded balances, not bank verification or external remittance reconciliation.</span></p>}
    <section className="grid gap-3 lg:grid-cols-2">
      {visibleJobs.map(j => <Card key={j.id} title={`${text(j.work_order_number)} · ${text(j.title)}`} href={`/work-orders/${j.id}`}>
        <div className="flex flex-wrap gap-2">{chip(text(j.status))}{chip(text(j.priority))}{chip(text(relation(j.locations).state))}</div>
        <Detail label="Customer / site" value={`${text(relation(j.customers).company_name)} · ${text(relation(j.locations).location_name)}`}/>
        <Detail label="Scope" value={text(j.scope_summary)}/>
        {view === "commitments" && <><Detail label="Scheduled (unverified)" value={text(j.scheduled_date)}/><Detail label="Due (unverified)" value={text(j.due_date)}/><Detail label="Requested (not confirmed)" value={text(j.requested_date)}/><p className="text-amber-300">Confirmation evidence not tracked in this view; check source before treating dates as firm.</p></>}
        {view === "blocked" && <><Detail label="Missing / follow-up" value={[!j.scope_summary && "Scope", !j.not_to_exceed_amount && "NTE / pricing", blockedStatuses.includes(String(j.status)) && j.status].filter(Boolean).join(", ") || "Review required"}/><Detail label="Notes / next action" value={text(j.internal_notes)}/></>}
        {view === "dispatch" && <><Detail label="Proposed / assigned crew" value={text(relation(j.subcontractors).company_name)}/><Detail label="Customer NTE (not sub pay)" value={dollars(Number(j.not_to_exceed_amount))}/><Detail label="Dispatch authorization" value="Verify explicit approval before sending; a listed crew is not authorization."/><Detail label="Labor, materials, travel" value="Not separately recorded on this work order; review job costs and subcontractor agreement."/><Detail label="Site check-in / checkout" value="Confirm arrival, site contact, access, departure and completion sign-off."/><Detail label="Photos" value="Before, during, after, close-ups, gate operation and completed work as applicable."/><Detail label="Equipment" value="Verify from scope and site conditions."/><Detail label="Next action / notes" value={text(j.internal_notes)}/></>}
        <Link className="text-orange-300 underline" href={`/work-orders/${j.id}`}>Open job card, edit notes and review files</Link>
      </Card>)}
      {view === "bids" && filteredQuotes.filter(q => !["approved","rejected","expired"].includes(String(q.status))).map(q => <Card key={q.id} title={`Quote ${text(q.quote_number)} · ${text(relation(q.work_orders).title)}`} href={`/quotes/${q.id}`}>
        <Detail label="Customer" value={text(relation(q.customers).company_name)}/><Detail label="Status" value={text(q.status)}/><Detail label="Quoted total" value={dollars(Number(q.total_amount))}/><Detail label="Valid until" value={text(q.valid_until)}/><Detail label="Next action / notes" value={text(q.internal_notes)}/><p className="text-amber-300">Quote is not approved until authorization is verified.</p>
      </Card>)}
      {view === "receivables" && filteredInvoices.map(i => <Card key={i.id} title={`Invoice ${text(i.invoice_number)}`} href={`/invoices/${i.id}`}>
        <Detail label="Customer" value={text(relation(i.customers).company_name)}/><Detail label="Status" value={text(i.status)}/><Detail label="Invoiced" value={dollars(Number(i.total_amount))}/><Detail label="Recorded paid" value={dollars(Number(i.amount_paid))}/><Detail label="Recorded owed" value={dollars(Math.max(0,Number(i.balance_due ?? (Number(i.total_amount ?? 0)-Number(i.amount_paid ?? 0)))))}/><Detail label="Due" value={text(i.due_date)}/><Detail label="Notes / disputes" value={text(i.notes)}/><p className="text-amber-300">Reconcile payment records and remittance before marking paid.</p>
      </Card>)}
      {((view === "bids" && !filteredQuotes.some(q=>!["approved","rejected","expired"].includes(String(q.status)))) || (view === "receivables" && !filteredInvoices.length) || (["commitments","blocked","dispatch"].includes(view) && !visibleJobs.length)) && <p className="rounded-xl border border-slate-700 p-5 text-slate-300">No matching records. This does not confirm that no outstanding work exists in external systems.</p>}
    </section>
  </main>;
}
