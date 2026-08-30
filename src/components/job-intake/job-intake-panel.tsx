"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ClipboardList, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type ParsedJobFields = {
  customerName?: string;
  storeNumber?: string;
  locationName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  workOrderNumber?: string;
  purchaseOrderNumber?: string;
  description?: string;
  jobDetails?: string;
  dneAmount?: number | null;
  timeframe?: string;
  dueDate?: string | null;
  requestedDate?: string | null;
  priority?: string;
  tradeType?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
};

type JobIntakeRecord = {
  id: string;
  status: "new" | "reviewed" | "tracked" | "dismissed";
  source: "gmail" | "mhelpdesk" | "truesource" | "manual";
  sourceRef: string;
  receivedAt: string;
  subject?: string;
  from?: string;
  snippet?: string;
  rawText: string;
  parsed: ParsedJobFields;
  notes: string;
  scheduledDate?: string | null;
  workOrderId?: string | null;
  emailDraft?: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    status: "draft" | "approved" | "sent";
  } | null;
};

function money(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value?.trim() || "—"}</p>
    </div>
  );
}

export function JobIntakePanel() {
  const [records, setRecords] = useState<JobIntakeRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [paste, setPaste] = useState("");
  const [source, setSource] = useState<"manual" | "mhelpdesk" | "truesource">("manual");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(() => records.find((r) => r.id === selectedId) ?? records[0] ?? null, [records, selectedId]);

  async function refresh() {
    const response = await fetch("/api/integrations/job-intake");
    const body = await response.json();
    setRecords(body.records ?? []);
    if (!selectedId && body.records?.[0]?.id) setSelectedId(body.records[0].id);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setNotes(selected.notes ?? "");
    setScheduledDate(selected.scheduledDate ?? "");
  }, [selected?.id]);

  function act(action: string, extra?: Record<string, unknown>) {
    if (!selected) return;
    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/integrations/job-intake/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, notes, scheduledDate: scheduledDate || null, ...extra }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Update failed.");
        return;
      }
      if (body.trackerLink && action === "accept_to_tracker") {
        setMessage(`Accepted into the Fortified tracker. Open ${body.trackerLink}`);
      } else {
        setMessage("Saved.");
      }
      await refresh();
    });
  }

  function importPaste() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/integrations/job-intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source,
          subject: `${source} assignment paste`,
          rawText: paste,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Import failed.");
        return;
      }
      setPaste("");
      setSelectedId(body.record.id);
      setMessage("Parsed into Fortified job brief.");
      await refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Intake queue</CardTitle>
            <CardDescription>mHelpDesk, TrueSource, Gmail, or pasted assignments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {records.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedId(record.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left ${
                  selected?.id === record.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{record.parsed.workOrderNumber || record.subject || "Untitled"}</p>
                  <Badge variant="outline">{record.source}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{record.parsed.description || record.snippet}</p>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Paste assignment</CardTitle>
            <CardDescription>Drop the national-account email or portal text here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="manual">Manual / other</option>
              <option value="mhelpdesk">mHelpDesk</option>
              <option value="truesource">TrueSource Affiliate Connect</option>
            </select>
            <Textarea rows={7} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Work Order #: ... Store #: ... DNE: ..." />
            <Button type="button" size="sm" disabled={isPending || !paste.trim()} onClick={importPaste}>
              Parse into Fortified format
            </Button>
          </CardContent>
        </Card>
      </div>

      {selected ? (
        <div className="space-y-4">
          {message ? <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">{message}</p> : null}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4" />
                Fortified job brief
              </CardTitle>
              <CardDescription>
                {selected.from} · {new Date(selected.receivedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Customer WO #" value={selected.parsed.workOrderNumber} />
              <Field label="PO #" value={selected.parsed.purchaseOrderNumber} />
              <Field label="Store #" value={selected.parsed.storeNumber} />
              <Field label="Customer" value={selected.parsed.customerName} />
              <Field label="Location" value={selected.parsed.locationName} />
              <Field label="Address" value={[selected.parsed.address, selected.parsed.city, selected.parsed.state, selected.parsed.zip].filter(Boolean).join(", ")} />
              <Field label="DNE / NTE" value={money(selected.parsed.dneAmount)} />
              <Field label="Timeframe" value={selected.parsed.timeframe} />
              <Field label="Priority" value={selected.parsed.priority} />
              <Field label="Trade" value={selected.parsed.tradeType} />
              <div className="md:col-span-2">
                <Field label="Scope" value={selected.parsed.description} />
              </div>
              <div className="md:col-span-2">
                <Field label="Details" value={selected.parsed.jobDetails} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tracker + dispatch</CardTitle>
              <CardDescription>Accept creates a Fortified work order you can send to a subcontractor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Internal notes</Label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Schedule date</Label>
                  <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={isPending} onClick={() => act("accept_to_tracker")}>
                  Accept to work orders
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={() => act("stage_mhelpdesk")}>
                  Stage national-account fields
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => act("refresh_email_draft")}>
                  <RefreshCw className="mr-1 size-3" />
                  Refresh email draft
                </Button>
                {selected.workOrderId && !selected.workOrderId.startsWith("local-") ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/work-orders/${selected.workOrderId}`}>Open work order</Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-4" />
                Outbound draft
              </CardTitle>
              <CardDescription>Approve before send. Nothing goes out until you confirm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">To:</span> {selected.emailDraft?.to || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Subject:</span> {selected.emailDraft?.subject || "—"}
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/60 p-3 text-xs">
                {selected.emailDraft?.body || "Refresh the draft after notes/dates are set."}
              </pre>
              <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={() => act("approve_email")}>
                Approve draft
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No intake records yet. Paste an assignment or connect Gmail in Settings.</CardContent>
        </Card>
      )}
    </div>
  );
}
