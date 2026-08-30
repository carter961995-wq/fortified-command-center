"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DispatchPanel({ workOrderId }: { workOrderId: string }) {
  const [packet, setPacket] = useState("");
  const [email, setEmail] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadPacket() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/dispatch-packet`);
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Could not build packet.");
        return;
      }
      setPacket(body.packet);
      setEmail(body.email);
    } finally {
      setBusy(false);
    }
  }

  async function copyPacket() {
    if (!packet) await loadPacket();
    const text = packet || (await (await fetch(`/api/work-orders/${workOrderId}/dispatch-packet`)).json()).packet;
    await navigator.clipboard.writeText(text);
    setMessage("Fortified dispatch packet copied. Paste it into email or text the subcontractor.");
  }

  function downloadPacket() {
    const blob = new Blob([packet], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fortified-dispatch-${workOrderId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispatch to subcontractor</CardTitle>
        <CardDescription>
          Generates Fortified&apos;s own work-order packet — not the national-account format — for the assigned crew.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={loadPacket}>
            Build Fortified packet
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={copyPacket}>
            Copy
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!packet} onClick={downloadPacket}>
            Download .txt
          </Button>
        </div>
        {email?.to ? <p className="text-sm text-muted-foreground">Suggested recipient: {email.to}</p> : null}
        {email?.subject ? <p className="text-sm font-medium">{email.subject}</p> : null}
        {packet ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/60 p-3 text-xs">
            {packet}
          </pre>
        ) : null}
        {message ? <p className="text-sm text-primary">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
