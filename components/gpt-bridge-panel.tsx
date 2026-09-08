"use client";

import { useEffect, useState } from "react";
import { Bot, Copy, KeyRound, RefreshCw } from "lucide-react";

type SettingsPayload = {
  ok: boolean;
  demoMode?: boolean;
  envOverrides?: boolean;
  hasKey?: boolean;
  apiKey?: string | null;
  keyPreview?: string | null;
  openApiUrl?: string;
  importUrl?: string;
  snapshotUrl?: string;
  instructions?: string;
  importLog?: Array<{ at: string; summary: string; counts: Record<string, number> }>;
  knowledgeCount?: number;
  business?: { companyName?: string; notes?: string };
  error?: string;
};

export function GptBridgePanel() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/gpt/v1/settings");
    setSettings(await response.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function copy(label: string, value?: string | null) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function rotate() {
    setBusy(true);
    try {
      const response = await fetch("/api/gpt/v1/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });
      const body = (await response.json()) as SettingsPayload;
      setSettings((current) => ({ ...(current ?? {}), ...body }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4 text-sm text-slate-400">
        Loading Fortified GPT bridge...
      </div>
    );
  }

  if (!settings.ok) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {settings.error ?? "Could not load GPT bridge settings."}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg bg-slate-950 text-orange-300">
          <Bot className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-black text-white">Fortified GPT bridge</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Connect the Custom GPT you already use for Fortified. It can push customers, job sites, subcontractors,
            projects, and shop knowledge into this Command Center, then dispatch crews against those records.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-[#0c172b] p-3">
          <p className="text-xs font-black uppercase text-slate-500">API key</p>
          <p className="mt-1 font-bold text-white">{settings.hasKey ? "Ready" : "Missing"}</p>
        </div>
        <div className="rounded-xl bg-[#0c172b] p-3">
          <p className="text-xs font-black uppercase text-slate-500">Knowledge saved</p>
          <p className="mt-1 font-bold text-white">{settings.knowledgeCount ?? 0}</p>
        </div>
        <div className="rounded-xl bg-[#0c172b] p-3">
          <p className="text-xs font-black uppercase text-slate-500">Last imports</p>
          <p className="mt-1 font-bold text-white">{settings.importLog?.length ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-3">
        <CopyRow label="Schema URL" value={settings.openApiUrl} copied={copied} onCopy={copy} />
        <CopyRow label="API key" value={settings.apiKey ?? ""} copied={copied} onCopy={copy} secret />
        <CopyRow label="Import endpoint" value={settings.importUrl} copied={copied} onCopy={copy} />
      </div>

      <ol className="grid gap-2 rounded-xl border border-[#223758] bg-[#0c172b] p-4 text-sm leading-6 text-slate-300">
        <li>1. In ChatGPT, open your Fortified GPT → Configure → Actions → Create new action.</li>
        <li>2. Import the schema URL above. Authentication is API Key, Auth Type Bearer, header `Authorization`.</li>
        <li>3. Paste the API key as the Bearer token.</li>
        <li>4. Add the GPT instructions below so it transfers what it already knows instead of keeping a second copy in chat.</li>
        <li>5. If this app is only on your Mac, expose it with a public HTTPS tunnel (Cloudflare Tunnel or ngrok) and use that origin in the schema URL.</li>
      </ol>

      <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-white">GPT instructions to paste</p>
          <button
            type="button"
            onClick={() => copy("instructions", settings.instructions)}
            className="inline-flex items-center gap-1 text-xs font-bold text-orange-300"
          >
            <Copy className="size-3.5" />
            {copied === "instructions" ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-300">
          {settings.instructions}
        </pre>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={rotate}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-black text-white hover:border-orange-400"
        >
          {busy ? <RefreshCw className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Rotate API key
        </button>
        {settings.envOverrides ? (
          <p className="text-xs font-semibold text-amber-200">
            `FORTIFIED_GPT_API_KEY` is set, so that environment value is the live key.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  secret,
}: {
  label: string;
  value?: string;
  copied: string | null;
  onCopy: (label: string, value?: string | null) => void;
  secret?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
        <button type="button" className="text-xs font-bold text-orange-300" onClick={() => onCopy(label, value)}>
          {copied === label ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-slate-200">
        {secret && value ? `${value.slice(0, 8)}…${value.slice(-4)}` : value || "—"}
      </p>
    </div>
  );
}
