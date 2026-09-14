import { NextResponse } from "next/server";
import { isDemoMode } from "../../../../lib/env";
import { ensureDemoIntegrations } from "../../../../lib/integrations/demo-bootstrap";
import { emailCategories, type EmailCategory } from "../../../../lib/integrations/email-classify";
import {
  inboxCounts,
  loadEmailInboxStore,
  searchInboxMessages,
} from "../../../../lib/integrations/email-inbox";
import { upsertJobIntakeFromSource } from "../../../../lib/integrations/job-intake";

export async function GET(request: Request) {
  if (isDemoMode()) await ensureDemoIntegrations();
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const categoryParam = url.searchParams.get("category") ?? "all";
  const category =
    categoryParam === "all" || emailCategories.includes(categoryParam as EmailCategory)
      ? (categoryParam as EmailCategory | "all")
      : "all";
  const store = await loadEmailInboxStore();
  const messages = searchInboxMessages(store.messages, query, category);
  return NextResponse.json({
    ok: true,
    updatedAt: store.updatedAt,
    counts: inboxCounts(store.messages),
    total: store.messages.length,
    messages,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; action?: "send_to_intake" };
    if (body.action !== "send_to_intake" || !body.id) {
      return NextResponse.json({ ok: false, error: "id and action=send_to_intake are required." }, { status: 400 });
    }
    const store = await loadEmailInboxStore();
    const message = store.messages.find((row) => row.id === body.id);
    if (!message) return NextResponse.json({ ok: false, error: "Message not found." }, { status: 404 });
    const { record, created } = await upsertJobIntakeFromSource({
      source: message.sourceHint === "manual" ? "gmail" : message.sourceHint,
      sourceRef: message.id,
      receivedAt: message.date,
      subject: message.subject,
      from: message.from,
      snippet: message.snippet,
      rawText: message.body || message.snippet,
    });
    return NextResponse.json({ ok: true, created, record });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Inbox update failed." },
      { status: 400 }
    );
  }
}
