"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Mail,
  MapPin,
  RefreshCw,
  Send,
  StickyNote,
} from "lucide-react";

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
  photoUrls: string[];
  workOrderId?: string | null;
  emailDraft?: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    status: "draft" | "approved" | "sent";
    updatedAt: string;
    sentAt?: string;
  } | null;
  mhelpdeskPush?: {
    status: "ready" | "pushed" | "failed" | "needs_connection";
    fieldMap: Record<string, unknown>;
    error?: string;
    updatedAt: string;
  } | null;
};

function money(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-[#0c172b] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value?.trim() || "—"}</p>
    </div>
  );
}

export function JobIntakePanel({ initialId }: { initialId?: string }) {
  const [records, setRecords] = useState<JobIntakeRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  const [message, setMessage] = useState("");
  const [manualText, setManualText] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? records[0] ?? null,
    [records, selectedId]
  );

  async function refresh() {
    const response = await fetch("/api/integrations/job-intake");
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || "Failed to load job intake.");
      return;
    }
    setRecords(body.records ?? []);
    if (!selectedId && body.records?.[0]?.id) setSelectedId(body.records[0].id);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patchSelected(payload: Record<string, unknown>, successMessage?: string) {
    if (!selected) return;
    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/integrations/job-intake/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Update failed.");
        return;
      }
      setRecords((current) => current.map((record) => (record.id === body.record.id ? body.record : record)));
      if (successMessage) setMessage(successMessage);
    });
  }

  function importManual() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/integrations/job-intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: "Manual job import",
          rawText: manualText,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Import failed.");
        return;
      }
      setManualText("");
      setSelectedId(body.record.id);
      await refresh();
      setMessage("Job parsed and added to the intake list.");
    });
  }

  function syncGmail() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/integrations/google/sync", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Gmail sync failed. Connect Google in Settings first.");
        return;
      }
      await refresh();
      const intake = body.summary?.jobIntake;
      setMessage(
        intake
          ? `Gmail sync complete. Scanned ${intake.scanned}, imported ${intake.imported}, updated ${intake.updated}.`
          : "Gmail sync complete."
      );
    });
  }

  function sendEmail() {
    if (!selected?.emailDraft) return;
    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/integrations/job-intake/${selected.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Send failed.");
        return;
      }
      setRecords((current) => current.map((record) => (record.id === body.record.id ? body.record : record)));
      setMessage("Email sent via Gmail.");
    });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">Automation</p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-white">Job Intake</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-400">
            New Gmail assignments and mHelpDesk alerts are parsed into a clean job brief, then added to your tracker
            with notes, schedule dates, photos, approve-before-send email, and mHelpDesk field mapping.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-[#2b4168] px-4 py-2 text-sm font-black text-slate-200"
            disabled={isPending}
            onClick={() => refresh()}
            type="button"
          >
            <RefreshCw className="mr-2 inline size-4" />
            Refresh
          </button>
          <button
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600"
            disabled={isPending}
            onClick={syncGmail}
            type="button"
          >
            <Mail className="mr-2 inline size-4" />
            Sync Gmail jobs
          </button>
          <Link className="rounded-lg border border-[#2b4168] px-4 py-2 text-sm font-black text-slate-200" href="/settings">
            Integrations
          </Link>
        </div>
      </header>

      {message ? (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="overflow-hidden rounded-xl border border-[#1f304d] bg-[#111f38]">
          <div className="border-b border-[#1f304d] p-4">
            <h2 className="font-black text-white">Job tracker queue</h2>
            <p className="mt-1 text-xs text-slate-500">{records.length} jobs</p>
          </div>
          <div className="max-h-[720px] overflow-y-auto">
            {records.map((record) => {
              const active = selected?.id === record.id;
              return (
                <button
                  className={`block w-full border-b border-[#1f304d] p-4 text-left ${
                    active ? "bg-orange-500/10" : "hover:bg-[#172844]"
                  }`}
                  key={record.id}
                  onClick={() => setSelectedId(record.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-white">
                      {record.parsed.workOrderNumber || record.parsed.storeNumber || "New job"}
                    </p>
                    <span className="rounded-full border border-[#2b4168] px-2 py-0.5 text-[10px] font-black uppercase text-slate-300">
                      {record.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-400">
                    {record.parsed.description || record.subject || record.snippet}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
                    {record.source} · {new Date(record.receivedAt).toLocaleString()}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="grid gap-4">
          {selected ? (
            <>
              <section className="rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-orange-400">Clean job document</p>
                    <h2 className="mt-1 text-2xl font-black text-white">
                      {selected.parsed.description || selected.subject || "Job brief"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {selected.from || selected.source} · received {new Date(selected.receivedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white"
                      disabled={isPending}
                      onClick={() => patchSelected({ action: "accept_to_tracker" }, "Added to job tracker.")}
                      type="button"
                    >
                      <ClipboardList className="mr-2 inline size-3.5" />
                      Add to tracker
                    </button>
                    <button
                      className="rounded-lg border border-[#2b4168] px-3 py-2 text-xs font-black text-slate-200"
                      disabled={isPending}
                      onClick={() => patchSelected({ status: "reviewed" }, "Marked reviewed.")}
                      type="button"
                    >
                      Mark reviewed
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Work order #" value={selected.parsed.workOrderNumber} />
                  <Field label="Store #" value={selected.parsed.storeNumber} />
                  <Field label="PO #" value={selected.parsed.purchaseOrderNumber} />
                  <Field label="Customer" value={selected.parsed.customerName} />
                  <Field label="Location" value={selected.parsed.locationName} />
                  <Field
                    label="Address"
                    value={[selected.parsed.address, selected.parsed.city, selected.parsed.state, selected.parsed.zip]
                      .filter(Boolean)
                      .join(", ")}
                  />
                  <Field label="DNE / NTE" value={money(selected.parsed.dneAmount)} />
                  <Field label="Timeframe" value={selected.parsed.timeframe} />
                  <Field label="Priority" value={selected.parsed.priority} />
                  <Field label="Due date" value={selected.parsed.dueDate} />
                  <Field label="Contact" value={selected.parsed.contactName} />
                  <Field label="Phone" value={selected.parsed.contactPhone} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-[#223758] bg-[#0c172b] p-4">
                    <div className="mb-2 flex items-center gap-2 text-orange-300">
                      <MapPin className="size-4" />
                      <h3 className="text-sm font-black uppercase">Job details</h3>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {selected.parsed.jobDetails || selected.rawText.slice(0, 1200)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#223758] bg-[#0c172b] p-4">
                    <div className="mb-2 flex items-center gap-2 text-orange-300">
                      <StickyNote className="size-4" />
                      <h3 className="text-sm font-black uppercase">Your notes</h3>
                    </div>
                    <textarea
                      className="min-h-36 w-full rounded-lg border border-[#223758] bg-[#091225] p-3 text-sm text-slate-100 outline-none focus:border-orange-500"
                      defaultValue={selected.notes}
                      key={`${selected.id}-notes`}
                      onBlur={(event) => patchSelected({ notes: event.target.value }, "Notes saved.")}
                      placeholder="Site conditions, crew notes, parts needed..."
                    />
                    <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400">
                      <CalendarDays className="size-3.5" />
                      Scheduled date
                      <input
                        className="ml-auto rounded border border-[#223758] bg-[#091225] px-2 py-1 text-slate-100"
                        defaultValue={selected.scheduledDate ?? ""}
                        key={`${selected.id}-schedule`}
                        onBlur={(event) =>
                          patchSelected({ scheduledDate: event.target.value || null }, "Schedule saved.")
                        }
                        type="date"
                      />
                    </label>
                    {selected.workOrderId ? (
                      <p className="mt-3 text-xs font-semibold text-emerald-300">
                        Tracker link:{" "}
                        {selected.workOrderId.startsWith("local-")
                          ? "Local tracker (demo / no Supabase WO insert)"
                          : selected.workOrderId}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">Approve-before-send email</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Draft status: {selected.emailDraft?.status || "none"}
                      </p>
                    </div>
                    <button
                      className="rounded-lg border border-[#2b4168] px-3 py-2 text-xs font-black text-slate-200"
                      disabled={isPending}
                      onClick={() => patchSelected({ action: "refresh_email_draft" }, "Email draft refreshed.")}
                      type="button"
                    >
                      Rebuild draft
                    </button>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <input
                      className="rounded-lg border border-[#223758] bg-[#0c172b] px-3 py-2 text-sm text-white"
                      defaultValue={selected.emailDraft?.to || ""}
                      key={`${selected.id}-to`}
                      onBlur={(event) =>
                        patchSelected({
                          emailDraft: { ...(selected.emailDraft || {}), to: event.target.value, status: "draft" },
                        })
                      }
                      placeholder="To"
                    />
                    <input
                      className="rounded-lg border border-[#223758] bg-[#0c172b] px-3 py-2 text-sm text-white"
                      defaultValue={selected.emailDraft?.subject || ""}
                      key={`${selected.id}-subject`}
                      onBlur={(event) =>
                        patchSelected({
                          emailDraft: { ...(selected.emailDraft || {}), subject: event.target.value, status: "draft" },
                        })
                      }
                      placeholder="Subject"
                    />
                    <textarea
                      className="min-h-48 rounded-lg border border-[#223758] bg-[#0c172b] px-3 py-2 text-sm text-slate-100"
                      defaultValue={selected.emailDraft?.body || ""}
                      key={`${selected.id}-body`}
                      onBlur={(event) =>
                        patchSelected({
                          emailDraft: { ...(selected.emailDraft || {}), body: event.target.value, status: "draft" },
                        })
                      }
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200"
                      disabled={isPending}
                      onClick={() => patchSelected({ action: "approve_email" }, "Email approved. Ready to send.")}
                      type="button"
                    >
                      <CheckCircle2 className="mr-2 inline size-3.5" />
                      Approve draft
                    </button>
                    <button
                      className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                      disabled={isPending || selected.emailDraft?.status !== "approved"}
                      onClick={sendEmail}
                      type="button"
                    >
                      <Send className="mr-2 inline size-3.5" />
                      Send approved email
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
                  <h3 className="font-black text-white">mHelpDesk field mapping</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Status: {selected.mhelpdeskPush?.status || "needs_connection"}
                  </p>
                  <dl className="mt-4 grid gap-2 text-sm">
                    {Object.entries(selected.mhelpdeskPush?.fieldMap || {}).map(([key, value]) => (
                      <div className="grid grid-cols-[140px_1fr] gap-3 rounded-lg bg-[#0c172b] px-3 py-2" key={key}>
                        <dt className="font-black uppercase tracking-wide text-[10px] text-slate-500">{key}</dt>
                        <dd className="font-semibold text-slate-200">{String(value ?? "—")}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    className="mt-4 rounded-lg border border-[#2b4168] px-3 py-2 text-xs font-black text-slate-200"
                    disabled={isPending}
                    onClick={() =>
                      patchSelected({ action: "stage_mhelpdesk" }, "mHelpDesk payload staged with correct field map.")
                    }
                    type="button"
                  >
                    Stage mHelpDesk update
                  </button>
                  {selected.mhelpdeskPush?.error ? (
                    <p className="mt-3 text-xs font-semibold text-orange-300">{selected.mhelpdeskPush.error}</p>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">
                      Connect mHelpDesk in Settings. Email-bridge mode uses Gmail alerts; session sync stages mapped
                      fields for push once your tenant connector is available.
                    </p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-xl border border-[#1f304d] bg-[#111f38] p-8 text-sm text-slate-400">
              No job intake records yet. Sync Gmail or paste a job email below.
            </div>
          )}

          <section className="rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
            <h3 className="font-black text-white">Paste a job / work-order email</h3>
            <p className="mt-1 text-xs text-slate-500">
              Useful for mHelpDesk emails, dispatch forwards, or any assignment text.
            </p>
            <textarea
              className="mt-3 min-h-40 w-full rounded-lg border border-[#223758] bg-[#0c172b] p-3 text-sm text-slate-100"
              onChange={(event) => setManualText(event.target.value)}
              placeholder="Paste the full email or work order text..."
              value={manualText}
            />
            <button
              className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              disabled={isPending || !manualText.trim()}
              onClick={importManual}
              type="button"
            >
              Parse and add to list
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
