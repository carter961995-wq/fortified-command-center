"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Unplug } from "lucide-react";

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
      setNotes(body.connection.notes || "");
    }
  }

  useEffect(() => {
    refresh();
  }, [apiPath]);

  function connectAndPull() {
    startTransition(async () => {
      setMessage("");
      const mode: SourceMode = password || connection?.hasPassword ? "session_sync" : "email_bridge";
      const saveResponse = await fetch(apiPath, {
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
      const saveBody = await saveResponse.json();
      if (!saveResponse.ok) {
        setMessage(saveBody.error || `Failed to save ${title} login.`);
        return;
      }
      setPassword("");
      const syncResponse = await fetch(apiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const syncBody = await syncResponse.json();
      await fetch("/api/integrations/sync-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true }),
      }).catch(() => null);
      setMessage(
        syncBody.result?.message ||
          `${title} connected. Current work orders are being pulled and organized.`
      );
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
            {connected ? `Logged in as ${connection?.email}` : "Not connected"}
            {connection?.lastSyncAt ? ` · last pull ${new Date(connection.lastSyncAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="app-btn app-btn-primary" disabled={isPending} onClick={connectAndPull} type="button">
            <Link2 className="size-4" />
            {connected ? "Reconnect and pull" : `Log in to ${provider === "truesource" ? "Affiliate Connect" : "mHelpDesk"}`}
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
        <label className="app-field md:col-span-2">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={connection?.hasPassword ? "•••••••• (saved on this computer)" : "Same password you use on the dashboard"}
          />
        </label>
      </div>
      <label className="app-field">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Which inbox, store list, dispatch contacts…"
        />
      </label>
      <p className="text-sm font-semibold text-slate-300">
        After you log in, the Command Center pulls current work orders and also reads matching Gmail if you have signed
        in with Google. You do not need to keep working inside the other dashboard.
      </p>
    </div>
  );
}
