import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  Plus,
} from "lucide-react";
import { Card, ErrorNotice } from "./ui";
import { MeasurementTool } from "./measurement-tool";
import { JobIntakePanel } from "./job-intake-panel";
import { SubcontractorMapPanel } from "./subcontractor-map-panel";
import { displayValue, money, type PlainRow } from "../lib/business";
import { featurePageMap, moduleMap } from "../lib/schema";
import { fetchModuleRows } from "../lib/data";
import { toSubcontractorPins, toWorkOrderPins } from "../lib/subcontractor-pins";

function ToolHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-400">{description}</p>
      </div>
      {action}
    </header>
  );
}

function ComingSoonTool({ title, description, bullets }: { title: string; description: string; bullets: string[] }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <ToolHeader title={title} description={description} />
      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          {bullets.map((bullet) => (
            <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4" key={bullet}>
              <CheckCircle2 className="mb-3 size-5 text-orange-400" />
              <p className="text-sm font-semibold leading-6 text-slate-300">{bullet}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

async function LeadsPage() {
  const { data: customers, error } = await fetchModuleRows(moduleMap.customers);
  const leads = customers.filter((row) => row.status === "prospect");
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <ToolHeader
        title="Leads"
        description="Track bid opportunities, lead calls, source, and next action."
        action={<Link className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" href="/clients/new"><Plus className="mr-2 inline size-4" />Add lead</Link>}
      />
      <ErrorNotice message={error} />
      <div className="grid gap-4">
        {(leads.length ? leads : customers.slice(0, 4)).map((lead) => (
          <Link className="rounded-xl border border-[#223758] bg-[#111f38] p-4 hover:border-orange-500/50" href={`/customers/${String(lead.id)}`} key={String(lead.id)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-white">{displayValue(lead, "company_name")}</p>
                <p className="text-sm text-slate-400">{displayValue(lead, "contact_name")} · {displayValue(lead, "contact_phone")}</p>
              </div>
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase text-orange-300">
                {displayValue(lead, "status")}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

async function PlannerPage() {
  const { data: jobs, error } = await fetchModuleRows(moduleMap["work-orders"]);
  const scheduled = jobs.filter((job) => job.scheduled_date);
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <ToolHeader title="Planner" description="Dispatch calendar for estimates, installs, service calls, and follow-ups." />
      <ErrorNotice message={error} />
      <div className="grid gap-4 lg:grid-cols-3">
        {["Today", "This Week", "Needs Scheduling"].map((column) => (
          <section className="rounded-xl border border-[#1f304d] bg-[#111f38]" key={column}>
            <h2 className="border-b border-[#1f304d] p-4 font-black uppercase text-white">{column}</h2>
            <div className="grid gap-3 p-4">
              {(column === "Needs Scheduling" ? jobs.filter((job) => !job.scheduled_date) : scheduled).slice(0, 4).map((job) => (
                <Link className="rounded-lg bg-[#0c172b] p-3 hover:bg-[#14233d]" href={`/work-orders/${String(job.id)}`} key={`${column}-${String(job.id)}`}>
                  <p className="font-black text-white">{displayValue(job, "title")}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{displayValue(job, "work_order_number")} · {displayValue(job, "status")}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function EmailInboxPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <ToolHeader title="Email Inbox" description="Connect Gmail to pull leads and vendor messages straight into the app." />
      <section className="max-w-3xl rounded-xl border border-orange-500/40 bg-[#292827] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 text-orange-400" />
          <div>
            <h2 className="font-black uppercase text-white">Job assignment emails live in Job Intake</h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              Work-order and mHelpDesk assignment messages are parsed on the Job Intake page. Connect Google in Settings,
              then sync from Job Intake.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-[#263958] bg-[#111827] p-4 text-sm text-slate-400">
          <p className="font-black text-slate-200">How to connect:</p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Create a Google Cloud OAuth app for Gmail/Workspace access.</li>
            <li>Add Gmail read + send scopes and a Gemini API key in Settings → Integrations.</li>
            <li>Open Job Intake and run Sync Gmail jobs to import assignments into the tracker.</li>
          </ol>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-black text-slate-200" href="/job-intake">
            <Mail className="mr-2 inline size-4" />
            Open Job Intake
          </Link>
          <Link className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" href="/settings">Open Settings</Link>
        </div>
      </section>
    </div>
  );
}

async function SubcontractorMapPage() {
  const [{ data: subs, error }, { data: jobs, error: jobError }] = await Promise.all([
    fetchModuleRows(moduleMap.subcontractors),
    fetchModuleRows(moduleMap["work-orders"]),
  ]);
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <ToolHeader
        title="Subcontractor Map"
        description="Real street map of crew coverage and open job sites. Click a crew to open their card or dispatch an unassigned work order."
        action={
          <Link className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" href="/subcontractors/new">
            <Plus className="mr-2 inline size-4" />
            Add subcontractor
          </Link>
        }
      />
      <ErrorNotice message={error ?? jobError} />
      <SubcontractorMapPanel subcontractors={toSubcontractorPins(subs)} workOrders={toWorkOrderPins(jobs)} />
    </div>
  );
}

async function InvoicingToolPage() {
  const { data: invoices, error } = await fetchModuleRows(moduleMap.invoices);
  const unpaid = invoices.filter((invoice) => Number(invoice.balance_due ?? 0) > 0);
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <ToolHeader title="Invoicing" description="Invoice creation, tracking, balances, PDFs, and payment follow-up." action={<Link className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" href="/invoices/new">New invoice</Link>} />
      <ErrorNotice message={error} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm font-bold text-slate-400">Open invoices</p><p className="mt-2 text-3xl font-black text-white">{unpaid.length}</p></Card>
        <Card><p className="text-sm font-bold text-slate-400">Outstanding balance</p><p className="mt-2 text-3xl font-black text-orange-300">{money(unpaid.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0))}</p></Card>
        <Card><p className="text-sm font-bold text-slate-400">Tracked invoices</p><p className="mt-2 text-3xl font-black text-white">{invoices.length}</p></Card>
      </div>
      <div className="grid gap-3">
        {invoices.map((invoice) => (
          <Link className="rounded-xl border border-[#223758] bg-[#111f38] p-4 hover:border-orange-500/50" href={`/invoices/${String(invoice.id)}`} key={String(invoice.id)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-white">{displayValue(invoice, "invoice_number")}</p>
                <p className="text-sm text-slate-400">{displayValue(invoice, "customers.company_name")}</p>
              </div>
              <p className="font-black text-orange-300">{money(invoice.balance_due)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export async function FeaturePage({ slug }: { slug: string }) {
  const page = featurePageMap[slug];
  if (slug === "planner") return <PlannerPage />;
  if (slug === "leads") return <LeadsPage />;
  if (slug === "job-intake") return <JobIntakePanel />;
  if (slug === "email-inbox") return <EmailInboxPage />;
  if (slug === "measurement-tool") return <MeasurementTool />;
  if (slug === "subcontractor-map") return <SubcontractorMapPage />;
  if (slug === "invoices") return <InvoicingToolPage />;

  if (!page) return null;
  const bulletSets: Record<string, string[]> = {
    "measurement-tool": [
      "Capture linear feet, post counts, gates, hardware, and labor assumptions.",
      "Convert measurements into quote line items and materials lists.",
      "Attach photos and takeoff notes to jobs and customers.",
    ],
    "website-extractor": [
      "Paste a website and extract business name, phone, address, and services.",
      "Use Gemini to summarize likely fence/gate opportunities.",
      "Create a lead or customer record from extracted contact data.",
    ],
    documents: [
      "Store job photos, invoice PDFs, W-9s, insurance certificates, and customer files.",
      "Attach documents to clients, jobs, subcontractors, quotes, and invoices.",
      "Search files by customer, vendor, job number, status, and document type.",
    ],
    notepad: [
      "Capture call notes, field notes, estimating reminders, and vendor follow-ups.",
      "Turn notes into leads, customers, jobs, or invoice tasks.",
      "Keep a running daily command log for the owner/operator.",
    ],
    "fence-bible": [
      "Keep SOPs, pricing rules, install notes, scripts, and vendor playbooks.",
      "Ask Gemini questions against internal fence/gate/welding knowledge.",
      "Link answers back to estimates, job planning, and customer conversations.",
    ],
  };

  return (
    <ComingSoonTool
      title={page.title}
      description={page.description}
      bullets={bulletSets[slug] ?? [
        "This workspace is part of the command-center feature set.",
        "It will connect to customers, jobs, invoices, messages, and documents.",
        "The UI is ready for the next implementation pass.",
      ]}
    />
  );
}
