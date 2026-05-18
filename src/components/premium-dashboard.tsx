import type { ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Gauge,
  HardHat,
  LineChart,
  MapPin,
  RadioTower,
  Receipt,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { cn } from "@/lib/utils";
import { WorkOrderStatusBadge, InvoiceStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Icon = ComponentType<{ className?: string }>;

export type DashboardMetrics = {
  openWorkOrders: number;
  needQuotes: number;
  waitingOnSubQuote: number;
  readyToInvoice: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  revenueMonth: number;
  grossProfitMonth: number;
  margin: number;
  activeSubcontractors: number;
  activeMaintenance: number;
  urgentWorkOrders: number;
  productionWorkOrders: number;
  callbackWorkOrders: number;
  monthLabel: string;
};

export type DashboardWorkOrder = {
  id: string;
  work_order_number: string | null;
  title: string | null;
  status: string | null;
  priority: string | null;
  scheduled_date: string | null;
  customers?: unknown;
  locations?: unknown;
};

export type DashboardInvoice = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  total_amount: number | string | null;
  balance_due: number | string | null;
  due_date: string | null;
  customers?: unknown;
};

const priorityStyles: Record<string, string> = {
  Low: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  Medium: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  High: "border-orange-400/30 bg-orange-400/10 text-orange-100",
  Urgent: "border-red-400/40 bg-red-400/15 text-red-100",
};

const toneStyles = {
  blue: {
    shell: "border-sky-400/20 bg-sky-400/10 text-sky-100",
    icon: "bg-sky-400/15 text-sky-200",
    bar: "from-sky-400 to-cyan-300",
  },
  emerald: {
    shell: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    icon: "bg-emerald-400/15 text-emerald-200",
    bar: "from-emerald-400 to-teal-300",
  },
  amber: {
    shell: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    icon: "bg-amber-400/15 text-amber-200",
    bar: "from-amber-300 to-orange-400",
  },
  violet: {
    shell: "border-violet-400/20 bg-violet-400/10 text-violet-100",
    icon: "bg-violet-400/15 text-violet-200",
    bar: "from-violet-400 to-fuchsia-300",
  },
  rose: {
    shell: "border-rose-400/20 bg-rose-400/10 text-rose-100",
    icon: "bg-rose-400/15 text-rose-200",
    bar: "from-rose-400 to-red-300",
  },
} as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function getCustomerName(row: { customers?: unknown }) {
  return unwrapEmbed<{ company_name?: string }>(row.customers)?.company_name ?? "Unassigned";
}

function getLocationLabel(row: { locations?: unknown }) {
  const location = unwrapEmbed<{ city?: string | null; state?: string | null }>(row.locations);
  if (!location?.city && !location?.state) return "No location";
  return [location.city, location.state].filter(Boolean).join(", ");
}

function getDueLabel(dueDate: string | null) {
  if (!dueDate) return { label: "No due date", urgent: false };
  const today = new Date().toISOString().slice(0, 10);
  return {
    label: formatDate(dueDate),
    urgent: dueDate < today,
  };
}

function EmptyState({ icon: Icon, title, description }: { icon: Icon; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="font-medium text-foreground">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  helper: string;
  icon: Icon;
  tone: keyof typeof toneStyles;
  href?: string;
}) {
  const tile = (
    <Card className="relative overflow-hidden border-white/10 bg-white/[0.045] shadow-2xl shadow-black/10 backdrop-blur">
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", toneStyles[tone].bar)} />
      <CardHeader className="pb-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</CardTitle>
          </div>
          <div className={cn("flex size-10 items-center justify-center rounded-2xl", toneStyles[tone].icon)}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs leading-5 text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );

  if (!href) return tile;

  return (
    <Link href={href} className="block transition duration-200 hover:-translate-y-0.5">
      {tile}
    </Link>
  );
}

function PipelineStage({
  label,
  value,
  description,
  icon: Icon,
  tone,
  percent,
  href,
}: {
  label: string;
  value: number;
  description: string;
  icon: Icon;
  tone: keyof typeof toneStyles;
  percent: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className={cn("flex size-10 items-center justify-center rounded-2xl", toneStyles[tone].icon)}>
          <Icon className="size-5" />
        </div>
        <span className="text-2xl font-semibold tabular-nums text-white">{value}</span>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-white">{label}</h3>
          <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-white" />
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full bg-gradient-to-r", toneStyles[tone].bar)} style={{ width: `${percent}%` }} />
      </div>
    </Link>
  );
}

function FocusItem({
  label,
  value,
  detail,
  href,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
  icon: Icon;
  tone: keyof typeof toneStyles;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", toneStyles[tone].icon)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-medium text-white">{label}</p>
          <span className="text-xl font-semibold tabular-nums text-white">{value}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-white" />
    </Link>
  );
}

function WorkOrderRow({ row, variant = "recent" }: { row: DashboardWorkOrder; variant?: "recent" | "scheduled" }) {
  const priority = row.priority ?? "Medium";

  return (
    <Link
      href={`/work-orders/${row.id}`}
      className="group block rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-sky-300/30 hover:bg-white/[0.06]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{row.work_order_number ?? "Work order"}</span>
            <Badge variant="outline" className={cn("font-medium", priorityStyles[priority] ?? priorityStyles.Medium)}>
              {priority}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{row.title ?? "Untitled scope"}</p>
        </div>
        <WorkOrderStatusBadge status={row.status ?? "New"} />
      </div>
      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="size-3.5 shrink-0" />
          <span className="truncate">{getCustomerName(row)}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {variant === "scheduled" ? <CalendarClock className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
          <span className="truncate">{variant === "scheduled" ? formatDate(row.scheduled_date) : getLocationLabel(row)}</span>
        </div>
      </div>
    </Link>
  );
}

function InvoiceRow({ row }: { row: DashboardInvoice }) {
  const due = getDueLabel(row.due_date);

  return (
    <Link
      href={`/invoices/${row.id}`}
      className="group block rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-emerald-300/30 hover:bg-white/[0.06]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{row.invoice_number ?? "Invoice"}</div>
          <p className="mt-1 text-sm text-muted-foreground">{getCustomerName(row)}</p>
        </div>
        <InvoiceStatusBadge status={row.status ?? "sent"} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-black/15 p-3">
          <p className="text-xs text-muted-foreground">Balance due</p>
          <p className="mt-1 font-semibold tabular-nums text-white">{formatCurrency(row.balance_due)}</p>
        </div>
        <div className={cn("rounded-xl p-3", due.urgent ? "bg-red-500/10" : "bg-black/15")}>
          <p className="text-xs text-muted-foreground">Due date</p>
          <p className={cn("mt-1 font-semibold tabular-nums", due.urgent ? "text-red-100" : "text-white")}>{due.label}</p>
        </div>
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="h-64 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export function PremiumDashboardFallback() {
  return <DashboardSkeleton />;
}

export function PremiumDashboard({
  metrics,
  recentWorkOrders,
  scheduledWorkOrders,
  attentionInvoices,
}: {
  metrics: DashboardMetrics;
  recentWorkOrders: DashboardWorkOrder[];
  scheduledWorkOrders: DashboardWorkOrder[];
  attentionInvoices: DashboardInvoice[];
}) {
  const quoteDeskCount = metrics.needQuotes + metrics.waitingOnSubQuote;
  const cashPressure = metrics.unpaidInvoices + metrics.overdueInvoices;
  const operatingScore = clampScore(
    100 -
      metrics.overdueInvoices * 6 -
      metrics.urgentWorkOrders * 4 -
      metrics.needQuotes * 2 -
      metrics.waitingOnSubQuote * 2 -
      metrics.callbackWorkOrders * 5
  );
  const scoreLabel = operatingScore >= 85 ? "Clean runway" : operatingScore >= 70 ? "Needs tuning" : "High pressure";

  const pipeline = [
    {
      label: "Quote desk",
      value: quoteDeskCount,
      description: "Site info, scope, and subcontractor pricing queues.",
      icon: Target,
      tone: "amber" as const,
      href: "/work-orders?status=Quote%20Needed",
    },
    {
      label: "Production lane",
      value: metrics.productionWorkOrders,
      description: "Approved, scheduled, active, and review-stage work.",
      icon: Wrench,
      tone: "blue" as const,
      href: "/work-orders?status=Scheduled",
    },
    {
      label: "Invoice launchpad",
      value: metrics.readyToInvoice,
      description: "Completed scopes ready to become cash.",
      icon: Receipt,
      tone: "violet" as const,
      href: "/work-orders?status=Ready%20to%20Invoice",
    },
    {
      label: "Cash follow-up",
      value: cashPressure,
      description: "Open invoices that need collection attention.",
      icon: Banknote,
      tone: metrics.overdueInvoices > 0 ? ("rose" as const) : ("emerald" as const),
      href: "/invoices",
    },
  ];
  const maxPipelineValue = Math.max(1, ...pipeline.map((stage) => stage.value));

  const focusItems = [
    {
      label: "Urgent work orders",
      value: metrics.urgentWorkOrders,
      detail: "Priority work that should stay on the operator radar.",
      href: "/work-orders?priority=Urgent",
      icon: AlertTriangle,
      tone: "rose" as const,
    },
    {
      label: "Quote blockers",
      value: quoteDeskCount,
      detail: "Items waiting on site facts, quote work, or sub numbers.",
      href: "/work-orders?status=Quote%20Needed",
      icon: TimerReset,
      tone: "amber" as const,
    },
    {
      label: "Ready to invoice",
      value: metrics.readyToInvoice,
      detail: "Revenue waiting on billing action.",
      href: "/work-orders?status=Ready%20to%20Invoice",
      icon: Zap,
      tone: "violet" as const,
    },
    {
      label: "Past due invoices",
      value: metrics.overdueInvoices,
      detail: "Receivables past due with a remaining balance.",
      href: "/invoices",
      icon: AlertTriangle,
      tone: "rose" as const,
    },
  ];

  return (
    <div className="relative isolate -m-4 overflow-hidden px-4 pb-10 pt-4 md:-m-6 md:px-6 md:pt-6 lg:-m-8 lg:px-8 lg:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32rem),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_30rem),linear-gradient(180deg,rgba(15,23,42,0.2),transparent)]" />

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-80 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1fr_23rem]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-sky-300/20 bg-sky-300/10 text-sky-100">
                <Sparkles className="size-3" />
                Premium command center
              </Badge>
              <Badge variant="outline" className="border-white/10 bg-white/5 text-muted-foreground">
                {metrics.monthLabel}
              </Badge>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Run the operation from one smooth machine.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Dispatch, quoting, production, invoicing, maintenance, and cash pressure are fused into a single executive-grade cockpit.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 rounded-full bg-white text-slate-950 hover:bg-white/90">
                <Link href="/work-orders/new">
                  <ClipboardList className="size-4" />
                  New work order
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Link href="/invoices/new">
                  <FileText className="size-4" />
                  Create invoice
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-11 rounded-full text-muted-foreground hover:bg-white/10 hover:text-white">
                <Link href="/reports">
                  <LineChart className="size-4" />
                  View reports
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Open work</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{metrics.openWorkOrders}</p>
                <p className="mt-1 text-xs text-muted-foreground">Excludes closed and cancelled</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">MTD revenue</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{compactCurrency(metrics.revenueMonth)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Booked invoice value</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Gross margin</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{metrics.margin}%</p>
                <p className="mt-1 text-xs text-muted-foreground">Linked work order P&L</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Operations score</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{scoreLabel}</h2>
              </div>
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
                <Gauge className="size-5" />
              </div>
            </div>

            <div className="my-7 flex justify-center">
              <div
                className="grid size-40 place-items-center rounded-full p-2"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${operatingScore}%, rgba(255,255,255,0.1) ${operatingScore}% 100%)`,
                }}
              >
                <div className="grid size-full place-items-center rounded-full bg-slate-950/95 text-center">
                  <div>
                    <div className="text-4xl font-semibold tabular-nums text-white">{operatingScore}</div>
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">score</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="size-4 text-emerald-300" />
                  Active subs
                </span>
                <span className="font-semibold tabular-nums text-white">{metrics.activeSubcontractors}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wrench className="size-4 text-sky-300" />
                  Maintenance contracts
                </span>
                <span className="font-semibold tabular-nums text-white">{metrics.activeMaintenance}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RadioTower className="size-4 text-rose-300" />
                  Callback / warranty
                </span>
                <span className="font-semibold tabular-nums text-white">{metrics.callbackWorkOrders}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Revenue this month"
          value={formatCurrency(metrics.revenueMonth)}
          helper={`Invoice value for ${metrics.monthLabel}`}
          icon={CircleDollarSign}
          tone="emerald"
          href="/reports"
        />
        <MetricTile
          label="Gross profit this month"
          value={formatCurrency(metrics.grossProfitMonth)}
          helper="Profit snapshot from linked work order financials"
          icon={TrendingUp}
          tone="blue"
          href="/reports"
        />
        <MetricTile
          label="Unpaid invoices"
          value={String(metrics.unpaidInvoices)}
          helper={`${pluralize(metrics.overdueInvoices, "invoice")} past due`}
          icon={Receipt}
          tone={metrics.overdueInvoices > 0 ? "rose" : "emerald"}
          href="/invoices"
        />
        <MetricTile
          label="Ready to invoice"
          value={String(metrics.readyToInvoice)}
          helper="Completed work waiting for billing"
          icon={CheckCircle2}
          tone="violet"
          href="/work-orders?status=Ready%20to%20Invoice"
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/10 bg-slate-950/50 shadow-2xl shadow-black/15 backdrop-blur">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-white">Operational pipeline</CardTitle>
                <CardDescription>Every stage has a clickable path into the work queue.</CardDescription>
              </div>
              <Badge variant="outline" className="border-white/10 bg-white/5 text-muted-foreground">
                {pluralize(metrics.openWorkOrders, "open order")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {pipeline.map((stage) => (
              <PipelineStage
                key={stage.label}
                {...stage}
                percent={Math.max(8, Math.round((stage.value / maxPipelineValue) * 100))}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/50 shadow-2xl shadow-black/15 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl text-white">Operator focus</CardTitle>
            <CardDescription>The highest-leverage moves for the next pass.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {focusItems.map((item) => (
              <FocusItem key={item.label} {...item} />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="border-white/10 bg-slate-950/50 shadow-2xl shadow-black/15 backdrop-blur xl:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-white">Work order radar</CardTitle>
                <CardDescription>Fresh activity with customer, location, status, and priority context.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                <Link href="/work-orders">
                  View all
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {recentWorkOrders.length ? (
              recentWorkOrders.slice(0, 8).map((row) => <WorkOrderRow key={row.id} row={row} />)
            ) : (
              <div className="lg:col-span-2">
                <EmptyState
                  icon={ClipboardList}
                  title="No work orders yet"
                  description="Create a work order to start feeding the command center."
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/50 shadow-2xl shadow-black/15 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl text-white">Next dispatches</CardTitle>
            <CardDescription>Upcoming scheduled field dates.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {scheduledWorkOrders.length ? (
              scheduledWorkOrders.slice(0, 6).map((row) => <WorkOrderRow key={row.id} row={row} variant="scheduled" />)
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="Schedule is clear"
                description="No upcoming field dates are currently on the board."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-white/10 bg-slate-950/50 shadow-2xl shadow-black/15 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl text-white">Fleet readiness</CardTitle>
            <CardDescription>Vendor capacity and recurring maintenance coverage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-100">
                    <HardHat className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Subcontractor bench</p>
                    <p className="text-xs text-emerald-100/70">Active and ready vendors</p>
                  </div>
                </div>
                <p className="text-3xl font-semibold tabular-nums text-white">{metrics.activeSubcontractors}</p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-sky-400/20 bg-sky-400/10 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-100">
                    <CalendarClock className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Recurring coverage</p>
                    <p className="text-xs text-sky-100/70">Active maintenance agreements</p>
                  </div>
                </div>
                <p className="text-3xl font-semibold tabular-nums text-white">{metrics.activeMaintenance}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/50 shadow-2xl shadow-black/15 backdrop-blur">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-white">Cash command</CardTitle>
                <CardDescription>Open receivables that deserve follow-up.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                <Link href="/invoices">
                  Open AR
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {attentionInvoices.length ? (
              attentionInvoices.slice(0, 8).map((row) => <InvoiceRow key={row.id} row={row} />)
            ) : (
              <div className="md:col-span-2">
                <EmptyState
                  icon={Receipt}
                  title="Cash lane is clean"
                  description="No unpaid invoices are currently in follow-up status."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
