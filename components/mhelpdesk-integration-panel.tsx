"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, RefreshCw, Unplug } from "lucide-react";

type Connection = {
  baseUrl: string;
  email: string;
  hasPassword: boolean;
  mode: "email_bridge" | "session_sync" | "manual";
  connectedAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  notes?: string;
};

export function MhelpdeskIntegrationPanel() {
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [baseUrl, setBaseUrl] = useState("https://app.mhelpdesk.com");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Connection["mode"]>("email_bridge");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const response = await fetch("/api/integrations/mhelpdesk");
    const body = await response.json();
    setConnected(Boolean(body.connected));
    setConnection(body.connection);
    if (body.connection) {
      setBaseUrl(body.connection.baseUrl || "https://app.mhelpdesk.com");
      setEmail(body.connection.email || "");
      setMode(body.connection.mode || "email_bridge");
      setNotes(body.connection.notes || "");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function save() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/integrations/mhelpdesk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          baseUrl,
          email,
          password: password || undefined,
          mode,
          notes,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Failed to save mHelpDesk connection.");
        return;
      }
      setPassword("");
      setMessage("mHelpDesk connection saved.");
      await refresh();
    });
  }

  function disconnect() {
    startTransition(async () => {
      await fetch("/api/integrations/mhelpdesk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setMessage("mHelpDesk disconnected.");
      await refresh();
    });
  }

  function sync() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/integrations/mhelpdesk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Sync failed.");
        return;
      }
      setMessage(body.result?.message || "Sync complete.");
      await refresh();
    });
  }

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm font-semibold text-orange-200">
          {message}
        </div>
      ) : null}

      <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-black text-white">mHelpDesk dashboard link</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Recommended path: <span className="text-orange-300">email bridge</span> — when mHelpDesk emails you a new
              job/alert, Gmail sync parses it into Job Intake. Session sync is available for staged dashboard imports
              once your tenant connector is ready.
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Status: {connected ? `Connected as ${connection?.email}` : "Not connected"}
              {connection?.lastSyncAt ? ` · last sync ${new Date(connection.lastSyncAt).toLocaleString()}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white"
              disabled={isPending}
              onClick={save}
              type="button"
            >
              <Link2 className="mr-2 inline size-4" />
              Save connection
            </button>
            <button
              className="rounded-lg border border-[#2b4168] px-4 py-2 text-sm font-black text-slate-200"
              disabled={isPending || !connected}
              onClick={sync}
              type="button"
            >
              <RefreshCw className="mr-2 inline size-4" />
              Sync now
            </button>
            {connected ? (
              <button
                className="rounded-lg border border-[#2b4168] px-4 py-2 text-sm font-black text-slate-200"
                disabled={isPending}
                onClick={disconnect}
                type="button"
              >
                <Unplug className="mr-2 inline size-4" />
                Disconnect
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
            Dashboard URL
            <input
              className="rounded-lg border border-[#223758] bg-[#091225] px-3 py-2 text-sm font-semibold normal-case text-white"
              onChange={(event) => setBaseUrl(event.target.value)}
              value={baseUrl}
            />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
            Login email
            <input
              className="rounded-lg border border-[#223758] bg-[#091225] px-3 py-2 text-sm font-semibold normal-case text-white"
              onChange={(event) => setEmail(event.target.value)}
              value={email}
            />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
            Password (optional, stored locally)
            <input
              className="rounded-lg border border-[#223758] bg-[#091225] px-3 py-2 text-sm font-semibold normal-case text-white"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={connection?.hasPassword ? "•••••••• (saved)" : "Only if using session sync"}
              type="password"
              value={password}
            />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
            Mode
            <select
              className="rounded-lg border border-[#223758] bg-[#091225] px-3 py-2 text-sm font-semibold normal-case text-white"
              onChange={(event) => setMode(event.target.value as Connection["mode"])}
              value={mode}
            >
              <option value="email_bridge">Email bridge (Gmail assignment emails)</option>
              <option value="session_sync">Session sync (staged dashboard import)</option>
              <option value="manual">Manual paste only</option>
            </select>
          </label>
        </div>
        <label className="mt-3 grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
          Notes
          <textarea
            className="min-h-20 rounded-lg border border-[#223758] bg-[#091225] px-3 py-2 text-sm font-semibold normal-case text-white"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Tenant tips, which alert emails to watch, custom field names..."
            value={notes}
          />
        </label>
      </div>
    </div>
  );
}
