import { PRICE_CATALOG, COMPANY_OVERHEAD, jobEstimate, searchCatalog } from "@/lib/pricing/catalog";
import { buildFortifiedDispatchPacket } from "@/lib/dispatch/packet";

export type AgentMessage = { role: "user" | "assistant"; content: string };

export type AgentContext = {
  openWorkOrders: Array<{
    id: string;
    work_order_number: string;
    title: string;
    status: string;
    priority: string;
    trade_type?: string;
    scheduled_date?: string | null;
    customer?: string | null;
    city?: string | null;
    state?: string | null;
    subcontractor?: string | null;
  }>;
  invoices: Array<{
    invoice_number: string;
    status: string;
    balance_due: number;
    customer?: string | null;
  }>;
  subcontractors: Array<{ company_name: string; city?: string | null; state?: string | null; trades?: string | null }>;
};

const SYSTEM_PROMPT = `You are Fortified Command, the in-house operations assistant for Fortified Fence & Weld.
The company does commercial fence, gates, welding, security grilles, bollards, and facilities maintenance for national facility programs (mHelpDesk, TrueSource Affiliate Connect, and similar).

Help the owner/dispatcher with:
- finding and organizing open work orders
- converting national-account jobs into Fortified work orders
- dispatching subcontractors and drafting the Fortified WO packet
- pricing materials, subs, equipment, and overhead
- invoicing and job-cost questions
- where to click in this desktop app

Be concise, practical, and specific. Use the live company data provided. If something is unknown, say so and point to the right screen (Job Intake, Work Orders, Pricing, Settings).
Never invent live portal credentials or claim you scraped a vendor website.`;

function localAnswer(question: string, context: AgentContext) {
  const q = question.toLowerCase();
  const open = context.openWorkOrders.filter((wo) => !["Closed", "Cancelled", "Paid"].includes(wo.status));

  if (/\b(price|pricing|cost|rate|overhead|material|catalog)\b/.test(q)) {
    const hits = searchCatalog(question.replace(/price|pricing|cost|rate|what|is|the|for/gi, " "));
    const rows = (hits.length ? hits : PRICE_CATALOG).slice(0, 8);
    const example = jobEstimate({ material: 640, subcontractor: 850, equipment: 285 });
    return [
      "Pricing desk — Fortified catalog (cost / suggested sell):",
      ...rows.map((item) => `• ${item.name} — $${item.cost}/${item.unit}${item.sell ? ` sell $${item.sell}` : ""}`),
      "",
      `Overhead burden ${COMPANY_OVERHEAD.burdenPercent}%, profit target ${COMPANY_OVERHEAD.profitTargetPercent}%, default trip $${COMPANY_OVERHEAD.tripChargeDefault}.`,
      `Example mix (mat $640 + sub $850 + eq $285): cost w/ OH $${example.costWithOh}, suggested sell $${example.suggestedSell}.`,
      "Open Pricing in the sidebar to browse the full book.",
    ].join("\n");
  }

  if (/\b(invoice|billing|ar|unpaid|balance)\b/.test(q)) {
    const openInv = context.invoices.filter((inv) => Number(inv.balance_due) > 0);
    return [
      `${openInv.length} invoice(s) with a balance:`,
      ...openInv.slice(0, 8).map((inv) => `• ${inv.invoice_number} · ${inv.customer ?? "—"} · $${Number(inv.balance_due).toFixed(2)} · ${inv.status}`),
      "",
      "Open Invoices to generate the Fortified PDF or record a payment.",
    ].join("\n");
  }

  if (/\b(dispatch|sub|packet|send|assign)\b/.test(q)) {
    const unassigned = open.filter((wo) => !wo.subcontractor);
    const sample = open[0];
    const packet = sample
      ? buildFortifiedDispatchPacket({
          workOrderNumber: sample.work_order_number,
          title: sample.title,
          status: sample.status,
          priority: sample.priority,
          tradeType: sample.trade_type || "Fence",
          customerName: sample.customer,
          city: sample.city,
          state: sample.state,
          scheduledDate: sample.scheduled_date,
          subcontractorName: sample.subcontractor,
        })
      : "No open work orders to packet.";
    return [
      `${unassigned.length} open job(s) still unassigned.`,
      "On a work order, use Dispatch packet to generate the Fortified subcontractor form, then log the email/text in Communications.",
      "",
      sample ? `Draft packet for ${sample.work_order_number}:\n\n${packet}` : "",
    ].join("\n");
  }

  if (/\b(intake|mhelp|truesource|gmail|import|national)\b/.test(q)) {
    return [
      "Job Intake converts mHelpDesk and TrueSource Affiliate Connect assignments into Fortified work orders.",
      "1. Connect Google / mHelpDesk / TrueSource in Settings.",
      "2. Open Job Intake and Sync or paste the assignment email.",
      "3. Review store #, customer WO #, DNE, dates, then Accept to tracker.",
      "4. Open the created work order and send the Fortified dispatch packet to the sub.",
    ].join("\n");
  }

  const filtered = open.filter((wo) => {
    if (/\bopen|active|pipeline\b/.test(q)) return true;
    return [wo.work_order_number, wo.title, wo.status, wo.customer, wo.city, wo.state, wo.subcontractor]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q.replace(/where|what|show|find|list|jobs?|work orders?/g, "").trim() || wo.status.toLowerCase());
  });
  const list = (filtered.length ? filtered : open).slice(0, 10);
  return [
    `${open.length} open work orders in the command center.`,
    ...list.map(
      (wo) =>
        `• ${wo.work_order_number} · ${wo.title} · ${wo.status} · ${wo.customer ?? "—"} · ${[wo.city, wo.state].filter(Boolean).join(", ") || "—"} · ${wo.subcontractor ?? "Unassigned"}`
    ),
    "",
    "Ask me to price a job, draft a dispatch packet, or walk through Job Intake.",
  ].join("\n");
}

export async function runCompanyAgent(messages: AgentMessage[], context: AgentContext) {
  const latest = messages[messages.length - 1]?.content ?? "";
  const fallback = localAnswer(latest, context);

  if (!process.env.GEMINI_API_KEY) {
    return { reply: fallback, source: "local" as const };
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const prompt = `${SYSTEM_PROMPT}

LIVE COMPANY SNAPSHOT
Open work orders: ${JSON.stringify(context.openWorkOrders.slice(0, 25))}
Open invoices: ${JSON.stringify(context.invoices.slice(0, 15))}
Subcontractors: ${JSON.stringify(context.subcontractors.slice(0, 20))}
Price book sample: ${JSON.stringify(PRICE_CATALOG.slice(0, 12))}
Overhead: ${JSON.stringify(COMPANY_OVERHEAD)}

Conversation:
${messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

Answer the latest user message. If Gemini is unsure, use the snapshot.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!response.ok || !text) {
      return { reply: fallback, source: "local" as const };
    }
    return { reply: String(text), source: "gemini" as const };
  } catch {
    return { reply: fallback, source: "local" as const };
  }
}
