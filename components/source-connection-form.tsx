"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, RefreshCw, Unplug } from "lucide-react";

export type SourceMode = "email_bridge" | "session_sync" | "manual";

type Connection = {
  baseUrl: string;
  email: string;
  hasPassword: boolean;
  mode: SourceMode;
  lastSyncAt?: string;
};

export function SourceConnectionForm({
  provider,
  title,
  description,
  defaultUrl,
  apiPath,
}: {
  provider: "mhelpdesk" | "truesource";
  title: string;
  description: string;
  defaultUrl: string;
  apiPath: string;
}) {
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [baseUrl, setBaseUrl] = useState(defaultUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<SourceMode>("email_bridge");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const response = await fetch(apiPath);
    const body = await response.json();
    setConnected(Boolean(body.connected));
    setConnection(body.connection);
    if (body.connection) {
      setBaseUrl(body.connection.baseUrl || defaultUrl);
      setEmail(body.connection.email || "");
      setMode(body.connection.mode || "email_bridge");
      setNotes(body.connection.notes || "");
    }
  }

  useEffect(() => {
    refresh();
  }, [apiPath]);

  function save() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch(apiPath, {
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
        setMessage(body.error || `Failed to save ${title} connection.`);
        return;
      }
      setPassword("");
      setMessage(`${title} connection saved. Jobs will land in Job Intake.`);
      await refresh();
    });
  }

  function disconnect() {
    startTransition(async () => {
      await fetch(apiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setMessage(`${title} disconnected.`);
      await refresh();
    });
  }

  function sync() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch(apiPath, {
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
        <div className="rounded-lg border border-orange-400/40 bg-orange-500/15 px-3 py-2 text-sm font-semibold text-orange-100">
          {message}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-200">{description}</p>
          <p className="mt-2 text-sm font-semibold text-orange-200">
            {connected ? `Connected as ${connection?.email}` : "Not connected"}
            {connection?.lastSyncAt ? ` · last sync ${new Date(connection.lastSyncAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="app-btn app-btn-primary" disabled={isPending} onClick={save} type="button">
            <Link2 className="size-4" />
            Save {provider === "truesource" ? "TrueSource" : "mHelpDesk"}
          </button>
          <button className="app-btn app-btn-secondary" disabled={isPending || !connected} onClick={sync} type="button">
            <RefreshCw className="size-4" />
            Test sync
          </button>
          {connected ? (
            <button className="app-btn app-btn-secondary" disabled={isPending} onClick={disconnect} type="button">
              <Unplug className="size-4" />
              Disconnect
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="app-field">
          Portal URL
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </label>
        <label className="app-field">
          Login email
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
        </label>
        <label className="app-field">
          Password (optional, stored on this machine)
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={connection?.hasPassword ? "•••••••• (saved)" : "Only needed for session sync"}
          />
        </label>
        <label className="app-field">
          How jobs arrive
          <select value={mode} onChange={(event) => setMode(event.target.value as SourceMode)}>
            <option value="email_bridge">Email bridge — parse assignment emails in Gmail</option>
            <option value="session_sync">Session sync — pull a sample / staged dashboard job</option>
            <option value="manual">Manual — paste job text in Job Intake</option>
          </select>
        </label>
      </div>
      <label className="app-field">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Which inbox, which alert emails, store list, dispatch contacts…"
        />
      </label>
    </div>
  );
}
