"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardList, Mail, RefreshCw, Search } from "lucide-react";

type EmailCategory =
  | "invitation_to_bid"
  | "quoted"
  | "approved_quote"
  | "work_order"
  | "invoice"
  | "other";

type InboxMessage = {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body?: string;
  category: EmailCategory;
  sourceHint: string;
  workOrderNumber?: string;
  storeNumber?: string;
  linkedIntakeId?: string | null;
};

const GROUPS: Array<{ id: EmailCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "invitation_to_bid", label: "Invitation to bid" },
  { id: "quoted", label: "Quoted" },
  { id: "approved_quote", label: "Approved quotes" },
  { id: "work_order", label: "Work orders" },
  { id: "invoice", label: "Invoices" },
  { id: "other", label: "Other" },
];

const labels: Record<EmailCategory, string> = {
  invitation_to_bid: "Invitation to bid",
  quoted: "Quoted",
  approved_quote: "Approved quotes",
  work_order: "Work orders",
  invoice: "Invoices",
  other: "Other",
};

export function EmailInboxPanel({ googleMessage }: { googleMessage?: string }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EmailCategory | "all">("all");
  const [notice, setNotice] = useState(googleMessage || "");
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => messages.find((message) => message.id === selectedId) ?? messages[0] ?? null,
    [messages, selectedId]
  );

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "all") params.set("category", category);
    const response = await fetch(`/api/integrations/email-inbox?${params.toString()}`);
    const body = await response.json();
    if (!response.ok) {
      setNotice(body.error || "Could not load inbox.");
      return;
    }
    setMessages(body.messages ?? []);
    setCounts(body.counts ?? {});
    setSelectedId((current) => current || body.messages?.[0]?.id);
  }, [category, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      await fetch("/api/integrations/sync-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ auto: true }),
      }).catch(() => null);
      if (!cancelled) await load();
    }
    boot();
    const timer = setInterval(() => {
      fetch("/api/integrations/sync-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ auto: true }),
      })
        .then(() => (cancelled ? null : load()))
        .catch(() => null);
    }, 120000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncNow() {
    startTransition(async () => {
      setNotice("");
      const response = await fetch("/api/integrations/sync-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const body = await response.json();
      await load();
      setNotice(body.summary?.message || body.error || "Inbox refreshed.");
    });
  }

  function sendToIntake() {
    if (!selected) return;
    startTransition(async () => {
      const response = await fetch("/api/integrations/email-inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send_to_intake", id: selected.id }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body.error || "Could not add to Job Intake.");
        return;
      }
      setNotice("Added to Job Intake and grouped with the matching project.");
      await load();
    });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">Mailbox</p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-white">Email Inbox</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-400">
            Sign in with Gmail once. The Command Center reads the mailbox and files items into invitation to bid,
            quoted, approved quotes, work orders, and invoices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-[#2b4168] px-4 py-2 text-sm font-black text-slate-200"
            disabled={isPending}
            onClick={syncNow}
            type="button"
          >
            <RefreshCw className="mr-2 inline size-4" />
            Sync mailbox
          </button>
          <Link className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" href="/job-sources">
            <Mail className="mr-2 inline size-4" />
            Connect Gmail
          </Link>
        </div>
      </header>

      {notice ? (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {GROUPS.map((group) => (
          <button
            key={group.id}
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${
              category === group.id
                ? "border-orange-400 bg-orange-500/20 text-orange-200"
                : "border-[#2b4168] text-slate-300"
            }`}
            onClick={() => setCategory(group.id)}
            type="button"
          >
            {group.label}
            {group.id !== "all" && counts[group.id] ? ` · ${counts[group.id]}` : ""}
          </button>
        ))}
      </div>

      <label className="relative block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <input
          className="w-full rounded-lg border border-[#223758] bg-[#0c172b] py-2 pl-10 pr-3 text-sm text-white outline-none focus:border-orange-500"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search bids, quotes, work orders, stores, senders…"
          value={query}
        />
      </label>

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <aside className="overflow-hidden rounded-xl border border-[#1f304d] bg-[#111f38]">
          <div className="border-b border-[#1f304d] p-4">
            <h2 className="font-black text-white">Grouped mail</h2>
            <p className="mt-1 text-xs text-slate-500">{messages.length} in this view</p>
          </div>
          <div className="max-h-[720px] overflow-y-auto">
            {messages.map((message) => {
              const active = selected?.id === message.id;
              return (
                <button
                  className={`block w-full border-b border-[#1f304d] p-4 text-left ${
                    active ? "bg-orange-500/10" : "hover:bg-[#172844]"
                  }`}
                  key={message.id}
                  onClick={() => setSelectedId(message.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 font-black text-white">{message.subject || "(no subject)"}</p>
                    <span className="shrink-0 rounded-full border border-[#2b4168] px-2 py-0.5 text-[10px] font-black uppercase text-slate-300">
                      {labels[message.category]}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-400">{message.snippet}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
                    {message.sourceHint} · {message.from}
                  </p>
                </button>
              );
            })}
            {!messages.length ? (
              <p className="p-4 text-sm text-slate-400">No messages in this group yet. Connect Gmail to pull the mailbox.</p>
            ) : null}
          </div>
        </aside>

        {selected ? (
          <section className="rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
            <p className="text-xs font-black uppercase tracking-wide text-orange-400">{labels[selected.category]}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{selected.subject || "(no subject)"}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {selected.from} · {new Date(selected.date).toLocaleString()}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-[#0c172b] px-3 py-2">
                <p className="text-[10px] font-black uppercase text-slate-500">Work order</p>
                <p className="mt-1 text-sm font-semibold text-white">{selected.workOrderNumber || "—"}</p>
              </div>
              <div className="rounded-lg bg-[#0c172b] px-3 py-2">
                <p className="text-[10px] font-black uppercase text-slate-500">Store</p>
                <p className="mt-1 text-sm font-semibold text-white">{selected.storeNumber || "—"}</p>
              </div>
              <div className="rounded-lg bg-[#0c172b] px-3 py-2">
                <p className="text-[10px] font-black uppercase text-slate-500">Source</p>
                <p className="mt-1 text-sm font-semibold text-white">{selected.sourceHint}</p>
              </div>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-[#223758] bg-[#0c172b] p-4 text-sm leading-6 text-slate-200">
              {selected.body || selected.snippet}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white"
                disabled={isPending}
                onClick={sendToIntake}
                type="button"
              >
                <ClipboardList className="mr-2 inline size-3.5" />
                Add to Job Intake
              </button>
              {selected.linkedIntakeId ? (
                <Link className="rounded-lg border border-[#2b4168] px-3 py-2 text-xs font-black text-slate-200" href="/job-intake">
                  Open Job Intake
                </Link>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-[#1f304d] bg-[#111f38] p-8 text-sm text-slate-400">
            Connect Gmail on Job Sources. After you sign in, this inbox fills and sorts itself.
          </section>
        )}
      </div>
    </div>
  );
}
