"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Loader2, Plus, Trash2 } from "lucide-react";
import type { BusinessProfile, KnowledgeEntry } from "../lib/integrations/gpt-bridge";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "sop", label: "SOP" },
  { id: "guideline", label: "Guidelines" },
  { id: "pricing", label: "Pricing" },
  { id: "script", label: "Scripts" },
  { id: "vendor", label: "Vendors" },
  { id: "general", label: "General" },
] as const;

type FenceBiblePanelProps = {
  initialBusiness: BusinessProfile;
  initialKnowledge: KnowledgeEntry[];
};

export function FenceBiblePanel({ initialBusiness, initialKnowledge }: FenceBiblePanelProps) {
  const [business, setBusiness] = useState(initialBusiness);
  const [knowledge, setKnowledge] = useState(initialKnowledge);
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  const [draft, setDraft] = useState({ title: "", category: "sop", content: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () => (filter === "all" ? knowledge : knowledge.filter((row) => row.category === filter)),
    [filter, knowledge]
  );

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/fence-bible", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not save Fence Bible.");
      if (body.knowledge) setKnowledge(body.knowledge);
      if (body.business) setBusiness(body.business);
      setMessage("Saved to Fence Bible. Fortified GPT can update these same records on the next sync.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Fence Bible.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry(entry: Partial<KnowledgeEntry> & { title: string; content: string; category: string }) {
    await post(entry);
  }

  async function addEntry() {
    if (!draft.title.trim() && !draft.content.trim()) return;
    const ok = await post({
      title: draft.title || "Untitled note",
      category: draft.category,
      content: draft.content,
    });
    if (ok) setDraft({ title: "", category: draft.category, content: "" });
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">Fence Bible</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-400">
            Company SOP, guidelines, pricing, and scripts live here. Fortified GPT can sync and update these records so
            the shop and the GPT stay on the same playbook.
          </p>
        </div>
        <Link className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-black text-slate-200" href="/settings">
          GPT bridge
        </Link>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-orange-300" />
          <h2 className="text-lg font-black text-white">Company profile</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label="Company name"
            value={business.companyName ?? ""}
            onChange={(value) => setBusiness((current) => ({ ...current, companyName: value }))}
          />
          <Field
            label="Phone"
            value={business.phone ?? ""}
            onChange={(value) => setBusiness((current) => ({ ...current, phone: value }))}
          />
          <Field
            label="Email"
            value={business.email ?? ""}
            onChange={(value) => setBusiness((current) => ({ ...current, email: value }))}
          />
          <Field
            label="Website"
            value={business.website ?? ""}
            onChange={(value) => setBusiness((current) => ({ ...current, website: value }))}
          />
        </div>
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Pricing data / rate rules</span>
          <textarea
            className="min-h-28 rounded-lg border border-[#2b4168] bg-[#0c172b] p-3 text-sm font-semibold text-slate-100 outline-none focus:border-orange-400"
            placeholder="Labor rates, trip charges, NTE rules, material markups..."
            value={business.pricingRules ?? ""}
            onChange={(event) => setBusiness((current) => ({ ...current, pricingRules: event.target.value }))}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Dispatch SOP</span>
          <textarea
            className="min-h-24 rounded-lg border border-[#2b4168] bg-[#0c172b] p-3 text-sm font-semibold text-slate-100 outline-none focus:border-orange-400"
            placeholder="How crews are chosen, coverage, after-hours rules..."
            value={business.dispatchRules ?? ""}
            onChange={(event) => setBusiness((current) => ({ ...current, dispatchRules: event.target.value }))}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Company guidelines</span>
          <textarea
            className="min-h-24 rounded-lg border border-[#2b4168] bg-[#0c172b] p-3 text-sm font-semibold text-slate-100 outline-none focus:border-orange-400"
            placeholder="Quality standards, customer communication, warranty notes..."
            value={business.notes ?? ""}
            onChange={(event) => setBusiness((current) => ({ ...current, notes: event.target.value }))}
          />
        </label>
        <button
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-60"
          disabled={busy}
          onClick={() => post({ action: "business", business })}
          type="button"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Save company profile
        </button>
      </section>

      <section className="grid gap-4 rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
        <h2 className="text-lg font-black text-white">Add SOP, guideline, or pricing note</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <Field label="Title" value={draft.title} onChange={(value) => setDraft((current) => ({ ...current, title: value }))} />
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Category</span>
            <select
              className="rounded-lg border border-[#2b4168] bg-[#0c172b] px-3 py-2 text-sm font-semibold text-white"
              value={draft.category}
              onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
            >
              {CATEGORIES.filter((item) => item.id !== "all").map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          className="min-h-28 rounded-lg border border-[#2b4168] bg-[#0c172b] p-3 text-sm font-semibold text-slate-100 outline-none focus:border-orange-400"
          placeholder="Write the SOP, guideline, or pricing note..."
          value={draft.content}
          onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
        />
        <button
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-orange-400 px-4 py-2 text-sm font-black text-orange-200 hover:bg-orange-500/10 disabled:opacity-60"
          disabled={busy}
          onClick={addEntry}
          type="button"
        >
          <Plus className="size-4" />
          Add to Fence Bible
        </button>
      </section>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((item) => (
          <button
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${
              filter === item.id
                ? "border-orange-400 bg-orange-500/15 text-orange-200"
                : "border-[#2b4168] bg-[#0c172b] text-slate-300"
            }`}
            key={item.id}
            onClick={() => setFilter(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2b4168] bg-[#0c172b] p-8 text-center">
            <h2 className="text-lg font-black text-white">No {filter === "all" ? "knowledge" : filter} entries yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
              Ask Fortified GPT to sync the company SOP, guidelines, and pricing, or add them here. Updates from GPT land
              in this list.
            </p>
          </div>
        ) : (
          visible.map((entry) => (
            <KnowledgeCard
              busy={busy}
              entry={entry}
              key={`${entry.id}-${entry.updatedAt}`}
              onDelete={() => post({ action: "delete", id: entry.id })}
              onSave={(next) => saveEntry(next)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KnowledgeCard({
  entry,
  busy,
  onSave,
  onDelete,
}: {
  entry: KnowledgeEntry;
  busy: boolean;
  onSave: (entry: KnowledgeEntry) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(entry.title);
  const [category, setCategory] = useState(entry.category);
  const [content, setContent] = useState(entry.content);

  return (
    <article className="grid gap-3 rounded-xl border border-[#223758] bg-[#111f38] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase text-orange-300">
          {category}
        </span>
        <p className="text-xs font-semibold text-slate-500">
          Updated {new Date(entry.updatedAt).toLocaleString()}
        </p>
      </div>
      <input
        className="rounded-lg border border-[#2b4168] bg-[#0c172b] px-3 py-2 text-sm font-black text-white outline-none focus:border-orange-400"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <select
        className="w-40 rounded-lg border border-[#2b4168] bg-[#0c172b] px-3 py-2 text-sm font-semibold text-white"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      >
        {CATEGORIES.filter((item) => item.id !== "all").map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <textarea
        className="min-h-32 rounded-lg border border-[#2b4168] bg-[#0c172b] p-3 text-sm font-semibold text-slate-100 outline-none focus:border-orange-400"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-black text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => onSave({ ...entry, title, category, content })}
          type="button"
        >
          Save
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-black text-red-200 disabled:opacity-50"
          disabled={busy}
          onClick={onDelete}
          type="button"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <input
        className="rounded-lg border border-[#2b4168] bg-[#0c172b] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-orange-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
