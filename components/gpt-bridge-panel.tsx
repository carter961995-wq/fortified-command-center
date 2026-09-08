"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, Copy, KeyRound, PlugZap, RefreshCw } from "lucide-react";

type SettingsPayload = {
  ok: boolean;
  demoMode?: boolean;
  envOverrides?: boolean;
  hasKey?: boolean;
  apiKey?: string | null;
  keyPreview?: string | null;
  publicBaseUrl?: string;
  localOrigin?: string;
  chatGptReady?: boolean;
  openApiUrl?: string;
  importUrl?: string;
  snapshotUrl?: string;
  knowledgeUrl?: string;
  updateUrl?: string;
  businessUrl?: string;
  instructions?: string;
  importLog?: Array<{ at: string; summary: string; counts: Record<string, number> }>;
  knowledgeCount?: number;
  business?: { companyName?: string; notes?: string };
  counts?: Record<string, number>;
  tested?: boolean;
  error?: string;
};

const CAPABILITIES = [
  { title: "Read the shop", detail: "Customers, jobs, crews, SOP, guidelines, and pricing via getSnapshot." },
  { title: "Write customers & jobs", detail: "Create or update a client, site, work order, or crew. Same name updates in place." },
  { title: "Edit SOP / pricing", detail: "Fence Bible entries and company rate rules. Tell it to change a price and it should save." },
  { title: "Dispatch", detail: "Assign a subcontractor to a live work order and mark it scheduled." },
];

export function GptBridgePanel() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | "rotate" | null>(null);
  const [testMessage, setTestMessage] = useState("");

  async function load() {
    const response = await fetch("/api/gpt/v1/settings");
    const body = (await response.json()) as SettingsPayload;
    setSettings(body);
    setPublicUrl(body.publicBaseUrl ?? "");
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

  async function savePublicUrl() {
    setBusy("save");
    setTestMessage("");
    try {
      const response = await fetch("/api/gpt/v1/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "savePublicUrl", publicBaseUrl: publicUrl }),
      });
      const body = (await response.json()) as SettingsPayload;
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not save public URL.");
      await load();
      setTestMessage("Saved. Copy the Schema URL below into the Custom GPT action.");
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : "Could not save public URL.");
    } finally {
      setBusy(null);
    }
  }

  async function testBridge() {
    setBusy("test");
    setTestMessage("");
    try {
      const response = await fetch("/api/gpt/v1/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const body = (await response.json()) as SettingsPayload;
      if (!response.ok || !body.ok) throw new Error(body.error || "Bridge test failed.");
      setSettings((current) => ({ ...(current ?? {}), ...body }));
      const counts = body.counts ?? {};
      setTestMessage(
        `Bridge is live. GPT can currently read ${counts.customers ?? 0} customers, ${counts.workOrders ?? 0} jobs, ${counts.subcontractors ?? 0} crews, and ${body.knowledge ?? 0} Fence Bible notes.`
      );
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : "Bridge test failed.");
    } finally {
      setBusy(null);
    }
  }

  async function rotate() {
    setBusy("rotate");
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
      setBusy(null);
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
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
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
          <h2 className="text-lg font-black text-white">Make Fortified GPT a team member</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Your Custom GPT connects through Actions (an API key + this schema). After that it can read and write the
            live shop: customers, jobs, crews, SOP, guidelines, pricing, and dispatch. Changes show in Clients, Jobs,
            and Fence Bible — not only in the chat.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {CAPABILITIES.map((item) => (
          <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-3" key={item.title}>
            <p className="text-sm font-black text-white">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">{item.detail}</p>
          </div>
        ))}
      </div>

      {!settings.chatGptReady ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          ChatGPT cannot call <span className="font-mono text-xs">{settings.localOrigin}</span>. Start a public HTTPS
          tunnel to this app, paste that URL below, then import the schema in your Custom GPT.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100">
          Schema URL is HTTPS. ChatGPT can reach this origin.
        </div>
      )}

      <label className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">
          Public HTTPS URL (Cloudflare Tunnel or ngrok)
        </span>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            className="flex-1 rounded-lg border border-[#2b4168] bg-[#0c172b] px-3 py-2 font-mono text-xs text-white outline-none focus:border-orange-400"
            placeholder="https://your-shop.trycloudflare.com"
            value={publicUrl}
            onChange={(event) => setPublicUrl(event.target.value)}
          />
          <button
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-60"
            disabled={busy === "save"}
            onClick={savePublicUrl}
            type="button"
          >
            Save URL
          </button>
        </div>
      </label>

      <div className="grid gap-3">
        <CopyRow label="1. Schema URL — paste into GPT Actions" value={settings.openApiUrl} copied={copied} onCopy={copy} />
        <CopyRow label="2. API key — Bearer token" value={settings.apiKey ?? ""} copied={copied} onCopy={copy} secret />
        <CopyRow label="Read snapshot" value={settings.snapshotUrl} copied={copied} onCopy={copy} />
        <CopyRow label="Write / update" value={settings.updateUrl} copied={copied} onCopy={copy} />
      </div>

      <ol className="grid gap-2 rounded-xl border border-[#223758] bg-[#0c172b] p-4 text-sm leading-6 text-slate-300">
        <li>
          <strong className="text-white">1. Tunnel.</strong> On the machine running this app:{" "}
          <code className="text-orange-200">cloudflared tunnel --url http://localhost:3000</code> or{" "}
          <code className="text-orange-200">ngrok http 3000</code>. Paste the https URL above and Save.
        </li>
        <li>
          <strong className="text-white">2. ChatGPT.</strong> Open your Fortified GPT → Configure → Actions → Create new
          action → Import from URL → paste the Schema URL.
        </li>
        <li>
          <strong className="text-white">3. Auth.</strong> Authentication = API Key, Auth Type = Bearer, header{" "}
          <code className="text-orange-200">Authorization</code>. Paste the API key as the token.
        </li>
        <li>
          <strong className="text-white">4. Instructions.</strong> Copy the teammate instructions below into the GPT
          instructions box so it writes into this app instead of keeping a second copy in chat.
        </li>
        <li>
          <strong className="text-white">5. Prove it.</strong> In the GPT: “Show current customers”, then “Update our
          chain-link labor rate to $X/ft.” Check{" "}
          <Link className="text-orange-300 underline" href="/fence-bible">
            Fence Bible
          </Link>{" "}
          and{" "}
          <Link className="text-orange-300 underline" href="/clients">
            Clients
          </Link>
          .
        </li>
      </ol>

      {testMessage ? (
        <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4 text-sm font-semibold text-slate-200">{testMessage}</div>
      ) : null}

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
          onClick={testBridge}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-black text-white hover:bg-orange-600"
        >
          {busy === "test" ? <RefreshCw className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
          Test GPT bridge
        </button>
        <button
          type="button"
          onClick={rotate}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-black text-white hover:border-orange-400"
        >
          {busy === "rotate" ? <RefreshCw className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Rotate API key
        </button>
        {settings.envOverrides ? (
          <p className="self-center text-xs font-semibold text-amber-200">
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
