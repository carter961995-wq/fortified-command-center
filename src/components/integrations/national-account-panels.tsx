"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function GoogleIntegrationPanel({ message }: { message?: string }) {
  const [status, setStatus] = useState<any>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refreshStatus() {
    const response = await fetch("/api/integrations/google/status");
    setStatus(await response.json());
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  if (!status) return <p className="text-sm text-muted-foreground">Loading Google status…</p>;

  return (
    <div className="space-y-3">
      {message ? <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">{message}</p> : null}
      <p className="text-sm text-muted-foreground">
        OAuth {status.googleOAuthConfigured ? "configured" : "needs client ID/secret"} · Account{" "}
        {status.connected ? status.email : "not connected"} · Gemini {status.geminiConfigured ? "ready" : "needs GEMINI_API_KEY"}
      </p>
      <p className="text-xs text-muted-foreground">Redirect URI: {status.redirectUri}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href="/api/integrations/google/connect">Connect Google</a>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || !status.connected}
          onClick={() =>
            startTransition(async () => {
              const response = await fetch("/api/integrations/google/sync", { method: "POST" });
              const body = await response.json();
              setSyncMessage(body.error || "Workspace sync complete.");
              await refreshStatus();
            })
          }
        >
          Sync Gmail jobs
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || !status.connected}
          onClick={() =>
            startTransition(async () => {
              await fetch("/api/integrations/google/disconnect", { method: "POST" });
              setSyncMessage("Google disconnected.");
              await refreshStatus();
            })
          }
        >
          Disconnect
        </Button>
      </div>
      {syncMessage ? <p className="text-sm">{syncMessage}</p> : null}
    </div>
  );
}

export function MhelpdeskIntegrationPanel() {
  const [email, setEmail] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://app.mhelpdesk.com");
  const [mode, setMode] = useState("email_bridge");
  const [notes, setNotes] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const response = await fetch("/api/integrations/mhelpdesk");
    const body = await response.json();
    setConnected(Boolean(body.connected));
    if (body.connection) {
      setEmail(body.connection.email || "");
      setBaseUrl(body.connection.baseUrl || "https://app.mhelpdesk.com");
      setMode(body.connection.mode || "email_bridge");
      setNotes(body.connection.notes || "");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Portal URL</Label>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Login email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Mode</Label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
            <option value="email_bridge">Email bridge (recommended)</option>
            <option value="session_sync">Staged portal sync</option>
            <option value="manual">Manual paste</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Password (stored locally only)</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tenant notes, brand, or dispatcher mailbox" />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const response = await fetch("/api/integrations/mhelpdesk", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "save", baseUrl, email, password: password || undefined, mode, notes }),
              });
              const body = await response.json();
              setMessage(body.error || "mHelpDesk connection saved.");
              await refresh();
            })
          }
        >
          Save mHelpDesk
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || !connected}
          onClick={() =>
            startTransition(async () => {
              const response = await fetch("/api/integrations/mhelpdesk", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "sync" }),
              });
              const body = await response.json();
              setMessage(body.result?.message || body.error || "Sync finished.");
            })
          }
        >
          Sync jobs
        </Button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

export function TruesourceIntegrationPanel() {
  const [email, setEmail] = useState("");
  const [portalUrl, setPortalUrl] = useState("https://affiliate.truesource.com");
  const [mode, setMode] = useState("email_bridge");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const response = await fetch("/api/integrations/truesource");
    const body = await response.json();
    setConnected(Boolean(body.connected));
    if (body.connection) {
      setEmail(body.connection.email || "");
      setPortalUrl(body.connection.portalUrl || "https://affiliate.truesource.com");
      setMode(body.connection.mode || "email_bridge");
      setNotes(body.connection.notes || "");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Affiliate Connect URL</Label>
          <Input value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Login email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Mode</Label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
            <option value="email_bridge">Email bridge (recommended)</option>
            <option value="portal_sync">Staged portal sync</option>
            <option value="manual">Manual paste</option>
          </select>
        </div>
      </div>
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Which national account uses this portal, mailbox to watch, etc." />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const response = await fetch("/api/integrations/truesource", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "save", portalUrl, email, mode, notes }),
              });
              const body = await response.json();
              setMessage(body.error || "TrueSource connection saved.");
              await refresh();
            })
          }
        >
          Save TrueSource
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || !connected}
          onClick={() =>
            startTransition(async () => {
              const response = await fetch("/api/integrations/truesource", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "sync" }),
              });
              const body = await response.json();
              setMessage(body.result?.message || body.error || "Sync finished.");
            })
          }
        >
          Sync jobs
        </Button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

export function NationalAccountCards() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Google Workspace / Gmail</CardTitle>
          <CardDescription>Watch assignment emails, then draft/send approved job updates.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleIntegrationPanel />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>mHelpDesk</CardTitle>
          <CardDescription>Email-bridge or staged sync. Job Intake maps store #, WO #, DNE, and dates into Fortified format.</CardDescription>
        </CardHeader>
        <CardContent>
          <MhelpdeskIntegrationPanel />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>TrueSource Affiliate Connect</CardTitle>
          <CardDescription>Same intake path for Affiliate Connect assignments — parse, convert, dispatch on Fortified paper.</CardDescription>
        </CardHeader>
        <CardContent>
          <TruesourceIntegrationPanel />
        </CardContent>
      </Card>
    </div>
  );
}
