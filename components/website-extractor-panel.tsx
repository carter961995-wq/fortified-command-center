"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { FileUp, Globe, Loader2, Save, Sparkles, UserPlus } from "lucide-react";

type ExtractedCompany = {
  companyName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  contactName: string;
  services: string[];
  summary: string;
  sourceUrl: string;
  geminiUsed?: boolean;
  geminiConfigured?: boolean;
};

const emptyRecord: ExtractedCompany = {
  companyName: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  contactName: "",
  services: [],
  summary: "",
  sourceUrl: "",
};

export function WebsiteExtractorPanel() {
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState("");
  const [extracted, setExtracted] = useState<ExtractedCompany>(emptyRecord);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"extract" | "lead" | "customer" | null>(null);

  const hasResult = useMemo(
    () => Boolean(extracted.companyName || extracted.phone || extracted.email || extracted.summary),
    [extracted]
  );

  async function extract(event: FormEvent) {
    event.preventDefault();
    setBusy("extract");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/website-extractor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "extract",
          url,
          html: fileName.toLowerCase().endsWith(".html") || fileName.toLowerCase().endsWith(".htm") ? pasted : undefined,
          text: pasted,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not extract that website.");
      setExtracted({
        ...emptyRecord,
        ...body.extracted,
        services: Array.isArray(body.extracted?.services) ? body.extracted.services : [],
      });
      setMessage(
        body.extracted?.geminiUsed
          ? "Extracted with Gemini and page text. Review the fields, then save a lead or customer."
          : "Extracted from the page. Review the fields, then save a lead or customer."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract that website.");
    } finally {
      setBusy(null);
    }
  }

  async function onUpload(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setPasted(await file.text());
  }

  async function save(as: "lead" | "customer") {
    setBusy(as === "lead" ? "lead" : "customer");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/website-extractor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", ...extracted, as }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not save that company.");
      setMessage(
        as === "lead"
          ? `Saved ${extracted.companyName} as a lead. It now shows on Leads and Clients.`
          : `Saved ${extracted.companyName} as a customer. It now shows on Clients.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that company.");
    } finally {
      setBusy(null);
    }
  }

  function update<K extends keyof ExtractedCompany>(key: K, value: ExtractedCompany[K]) {
    setExtracted((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">Website Extractor</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-400">
            Paste a company website, drop a page file, or type contact details. Extract name, phone, address, and services,
            then save a lead or customer in one place.
          </p>
        </div>
        <Link className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-black text-slate-200" href="/leads">
          Open leads
        </Link>
      </header>

      <form className="grid gap-4 rounded-xl border border-[#1f304d] bg-[#111f38] p-5" onSubmit={extract}>
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Company website</span>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                className="w-full rounded-lg border border-[#2b4168] bg-[#0c172b] py-2.5 pl-10 pr-3 text-sm font-semibold text-white outline-none focus:border-orange-400"
                placeholder="https://example-fence.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-60"
              disabled={busy === "extract"}
              type="submit"
            >
              {busy === "extract" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Extract
            </button>
          </div>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">
            Or paste page text / HTML {fileName ? `· ${fileName}` : ""}
          </span>
          <textarea
            className="min-h-36 rounded-lg border border-[#2b4168] bg-[#0c172b] p-3 text-sm font-semibold text-slate-100 outline-none focus:border-orange-400"
            placeholder="Paste the homepage, contact page, or a saved .html / .txt file..."
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
          />
        </label>

        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-[#0c172b] px-3 py-2 text-sm font-black text-slate-200">
          <FileUp className="size-4" />
          Upload .html or .txt
          <input
            className="hidden"
            type="file"
            accept=".html,.htm,.txt,.md,.csv,text/html,text/plain"
            onChange={(event) => onUpload(event.target.files?.[0])}
          />
        </label>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-[#1f304d] bg-[#111f38] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-white">Extracted company</h2>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-black text-white disabled:opacity-50"
              disabled={!extracted.companyName || Boolean(busy)}
              onClick={() => save("lead")}
              type="button"
            >
              {busy === "lead" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Save as lead
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-50"
              disabled={!extracted.companyName || Boolean(busy)}
              onClick={() => save("customer")}
              type="button"
            >
              {busy === "customer" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save as customer
            </button>
          </div>
        </div>

        {!hasResult ? (
          <p className="text-sm font-semibold text-slate-400">
            Enter a website and click Extract. You can still type over every field before saving.
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Company name" value={extracted.companyName} onChange={(value) => update("companyName", value)} />
          <Field label="Contact name" value={extracted.contactName} onChange={(value) => update("contactName", value)} />
          <Field label="Phone" value={extracted.phone} onChange={(value) => update("phone", value)} />
          <Field label="Email" value={extracted.email} onChange={(value) => update("email", value)} />
          <Field label="Website" value={extracted.website} onChange={(value) => update("website", value)} />
          <Field label="Address" value={extracted.address} onChange={(value) => update("address", value)} />
          <Field label="City" value={extracted.city} onChange={(value) => update("city", value)} />
          <Field label="State" value={extracted.state} onChange={(value) => update("state", value)} />
          <Field label="ZIP" value={extracted.zip} onChange={(value) => update("zip", value)} />
          <Field
            label="Services"
            value={extracted.services.join(", ")}
            onChange={(value) => update("services", value.split(",").map((item) => item.trim()).filter(Boolean))}
          />
        </div>
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Summary / opportunity</span>
          <textarea
            className="min-h-28 rounded-lg border border-[#2b4168] bg-[#0c172b] p-3 text-sm font-semibold text-slate-100 outline-none focus:border-orange-400"
            value={extracted.summary}
            onChange={(event) => update("summary", event.target.value)}
          />
        </label>
      </section>
    </div>
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
