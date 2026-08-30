"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function CompanyAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I'm Fortified Command. Ask me for open jobs, pricing, a dispatch packet, or how to pull a mHelpDesk / TrueSource assignment into our work-order format.",
    },
  ]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const body = await response.json();
      setMessages([
        ...next,
        { role: "assistant", content: body.reply || body.error || "I could not answer that just now." },
      ]);
    } catch {
      setMessages([...next, { role: "assistant", content: "The assistant is offline. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="secondary" className="gap-2" onClick={() => setOpen(true)}>
        <Bot className="size-4" />
        Fortified AI
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-3 sm:max-w-md">
          <div>
            <h2 className="text-lg font-semibold">Fortified Command</h2>
            <p className="text-sm text-muted-foreground">Company assistant for work orders, pricing, dispatch, and invoicing.</p>
          </div>
          <div className="flex-1 space-y-3 overflow-auto rounded-lg border border-border p-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  message.role === "user" ? "ml-6 bg-primary/15" : "mr-6 bg-muted/50"
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. What jobs are open in Texas? Price a 6ft chain link repair."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button type="button" size="sm" disabled={busy} onClick={send}>
              <Send className="size-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
