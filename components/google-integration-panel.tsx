"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Copy, Link2, RefreshCw, Unplug } from "lucide-react";

type Status = {
  googleOAuthConfigured: boolean;
  geminiConfigured: boolean;
  connected: boolean;
  email: string | null;
  name: string | null;
  scopes: string[];
  redirectUri: string;
  connectedAt: string | null;
  updatedAt: string | null;
  lastSync: null | {
    syncedAt: string;
    gmail: { messages: unknown[] };
    drive: { files: unknown[] };
    calendar: { events: unknown[] };
    jobIntake?: { scanned: number; imported: number; updated: number };
    gemini?: { configured: boolean; extraction?: unknown; error?: string };
  };
};

export function GoogleIntegrationPanel({ message }: { message?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refreshStatus() {
    const response = await fetch("/api/integrations/google/status");
    setStatus(await response.json());
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  function syncWorkspace() {
    setSyncMessage("");
    startTransition(async () => {
      const response = await fetch("/api/integrations/google/sync", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setSyncMessage(body.error ?? "Sync failed.");
        return;
      }
      setSyncMessage("Workspace sync complete.");
      await refreshStatus();
    });
  }

  function disconnect() {
    startTransition(async () => {
      await fetch("/api/integrations/google/disconnect", { method: "POST" });
      setSyncMessage("Google disconnected.");
      await refreshStatus();
    });
  }

  if (!status) {
    return <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4 text-sm text-slate-400">Loading Google integration status...</div>;
  }

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm font-semibold text-orange-200">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard label="Google OAuth" ok={status.googleOAuthConfigured} okText="Configured" missingText="Needs client ID/secret" />
        <StatusCard label="Google Account" ok={status.connected} okText={status.email ?? "Connected"} missingText="Not connected" />
        <StatusCard label="Gemini" ok={status.geminiConfigured} okText="API key set" missingText="Needs GEMINI_API_KEY" />
      </div>

      <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-black text-white">One-time Google login</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Connect once with Google OAuth. The app stores a refresh token locally so it can keep syncing Gmail,
              Drive metadata, Calendar events, and Contacts without making you sign in every time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-black ${
                status.googleOAuthConfigured ? "bg-orange-500 text-white hover:bg-orange-600" : "cursor-not-allowed bg-slate-700 text-slate-400"
              }`}
              href={status.googleOAuthConfigured ? "/api/integrations/google/connect" : "#"}
              aria-disabled={!status.googleOAuthConfigured}
            >
              <Link2 className="mr-2 size-4" />
              {status.connected ? "Reconnect Google" : "Connect Google"}
            </a>
            {status.connected ? (
              <button className="rounded-lg border border-[#2b4168] px-4 py-2 text-sm font-black text-slate-200" onClick={disconnect} disabled={isPending}>
                <Unplug className="mr-2 inline size-4" />
                Disconnect
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[#223758] bg-[#091225] p-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Google Cloud redirect URI</p>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
            <code className="flex-1 overflow-x-auto rounded bg-black/30 px-3 py-2 text-xs text-orange-200">{status.redirectUri}</code>
            <button
              className="rounded-lg border border-[#2b4168] px-3 py-2 text-xs font-black text-slate-200"
              onClick={() => navigator.clipboard.writeText(status.redirectUri)}
              type="button"
            >
              <Copy className="mr-2 inline size-3" />
              Copy
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-black text-white">Workspace sync</h3>
            <p className="mt-1 text-sm text-slate-400">
              Pulls recent Gmail messages (including job/work-order assignments), Drive file metadata, and Calendar
              events. Matching jobs are parsed into Job Intake. If Gemini is configured, it also extracts draft leads,
              work orders, contacts, and invoice tasks.
            </p>
          </div>
          <button
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-50"
            onClick={syncWorkspace}
            disabled={!status.connected || isPending}
            type="button"
          >
            <RefreshCw className="mr-2 inline size-4" />
            {isPending ? "Syncing..." : "Sync now"}
          </button>
        </div>

        {syncMessage ? <p className="mt-3 text-sm font-semibold text-orange-200">{syncMessage}</p> : null}

        {status.lastSync ? (
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <Metric label="Last sync" value={new Date(status.lastSync.syncedAt).toLocaleString()} />
            <Metric label="Gmail messages" value={String(status.lastSync.gmail.messages.length)} />
            <Metric label="Jobs imported" value={String(status.lastSync.jobIntake?.imported ?? 0)} />
            <Metric label="Drive files" value={String(status.lastSync.drive.files.length)} />
            <Metric label="Calendar events" value={String(status.lastSync.calendar.events.length)} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No Workspace sync has been run yet.</p>
        )}

        {status.lastSync?.gemini?.error ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            Gemini extraction error: {status.lastSync.gemini.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusCard({ label, ok, okText, missingText }: { label: string; ok: boolean; okText: string; missingText: string }) {
  return (
    <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 flex items-center gap-2 font-black ${ok ? "text-emerald-300" : "text-orange-300"}`}>
        {ok ? <CheckCircle2 className="size-4" /> : null}
        {ok ? okText : missingText}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#091225] p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
