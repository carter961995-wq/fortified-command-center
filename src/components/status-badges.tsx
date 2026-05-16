import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const WORK_ORDER_STATUS_STYLES: Record<string, string> = {
  New: "bg-zinc-500/15 text-zinc-200 border-zinc-500/30",
  "Needs Site Info": "bg-amber-500/15 text-amber-200 border-amber-500/30",
  "Waiting on Sub Quote": "bg-orange-500/15 text-orange-200 border-orange-500/30",
  "Quote Needed": "bg-orange-500/15 text-orange-200 border-orange-500/30",
  "Quote Sent": "bg-sky-500/15 text-sky-200 border-sky-500/30",
  Approved: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  Scheduled: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  "In Progress": "bg-blue-500/15 text-blue-200 border-blue-500/30",
  "Completed by Sub": "bg-teal-500/15 text-teal-200 border-teal-500/30",
  "Needs Review": "bg-orange-500/15 text-orange-200 border-orange-500/30",
  "Ready to Invoice": "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
  Invoiced: "bg-sky-600/15 text-sky-100 border-sky-600/30",
  Paid: "bg-emerald-600/15 text-emerald-100 border-emerald-600/30",
  Closed: "bg-zinc-600/15 text-zinc-300 border-zinc-600/30",
  "Callback/Warranty": "bg-red-500/15 text-red-200 border-red-500/30",
  Cancelled: "bg-red-600/15 text-red-100 border-red-600/30",
};

export function WorkOrderStatusBadge({ status }: { status: string }) {
  const cls = WORK_ORDER_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("font-medium", cls)}>
      {status}
    </Badge>
  );
}

const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  partially_paid: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  paid: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  overdue: "bg-red-500/15 text-red-200 border-red-500/30",
  void: "bg-zinc-600/15 text-zinc-400 border-zinc-600/30",
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cls = INVOICE_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", cls)}>
      {status.replace("_", " ")}
    </Badge>
  );
}

const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  approved: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-200 border-red-500/30",
  expired: "bg-zinc-600/15 text-zinc-400 border-zinc-600/30",
};

export function QuoteStatusBadge({ status }: { status: string }) {
  const cls = QUOTE_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", cls)}>
      {status}
    </Badge>
  );
}
