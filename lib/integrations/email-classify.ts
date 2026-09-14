export const emailCategories = [
  "invitation_to_bid",
  "quoted",
  "approved_quote",
  "work_order",
  "invoice",
  "other",
] as const;

export type EmailCategory = (typeof emailCategories)[number];

export const emailCategoryLabels: Record<EmailCategory, string> = {
  invitation_to_bid: "Invitation to bid",
  quoted: "Quoted",
  approved_quote: "Approved quotes",
  work_order: "Work orders",
  invoice: "Invoices",
  other: "Other",
};

export type DispatchSource = "gmail" | "mhelpdesk" | "truesource" | "manual";

export function haystackOf(input: {
  subject?: string;
  from?: string;
  snippet?: string;
  body?: string;
}) {
  return [input.subject, input.from, input.snippet, input.body].filter(Boolean).join("\n");
}

export function detectDispatchSource(input: {
  subject?: string;
  from?: string;
  snippet?: string;
  body?: string;
}): DispatchSource {
  const haystack = haystackOf(input);
  if (/\b(mhelpdesk|mhelp desk|mhelp)\b/i.test(haystack) || /mhelpdesk\.com/i.test(haystack)) {
    return "mhelpdesk";
  }
  if (/\b(truesource|true source|affiliate connect)\b/i.test(haystack) || /truesource\.com/i.test(haystack)) {
    return "truesource";
  }
  return "gmail";
}

export function classifyEmail(input: {
  subject?: string;
  from?: string;
  snippet?: string;
  body?: string;
}): EmailCategory {
  const haystack = haystackOf(input);

  if (
    /\b(quote approved|approved quote|proposal approved|notice to proceed|\bntp\b|po approved|award(ed)? the (job|bid|quote)|you(?:r)? quote (?:was |has been )?approved)\b/i.test(
      haystack
    )
  ) {
    return "approved_quote";
  }

  if (
    /\b(invitation to bid|\bitb\b|\brfp\b|request for (?:proposal|quote|bid)|please bid|bid request|bid opportunity|invited to bid|solicitation)\b/i.test(
      haystack
    )
  ) {
    return "invitation_to_bid";
  }

  if (
    /\b(quote sent|quoted|estimate sent|proposal submitted|quote submitted|our quote|pricing submitted|estimate attached)\b/i.test(
      haystack
    )
  ) {
    return "quoted";
  }

  if (/\b(invoice|remittance|payment received|past due|balance due)\b/i.test(haystack)) {
    return "invoice";
  }

  if (
    /\b(work\s*order|wo[#:\s-]|job\s*assigned|new\s*job|service\s*request|dispatch|ticket\s*(?:#|assigned)|mhelpdesk|affiliate connect|store\s*#|dne|n\.?t\.?e\.?)\b/i.test(
      haystack
    )
  ) {
    return "work_order";
  }

  return "other";
}

export function looksLikeOperationalEmail(input: {
  subject?: string;
  from?: string;
  snippet?: string;
  body?: string;
}) {
  return classifyEmail(input) !== "other";
}

export function projectKey(input: {
  customerName?: string;
  storeNumber?: string;
  locationName?: string;
  city?: string;
  state?: string;
}) {
  const parts = [
    input.customerName,
    input.storeNumber ? `Store ${input.storeNumber}` : null,
    input.locationName,
    [input.city, input.state].filter(Boolean).join(", ") || null,
  ].filter(Boolean);
  return parts.join(" · ") || "Unassigned project";
}

export function extractInboxIdentifiers(text: string) {
  const haystack = text || "";
  const pick = (re: RegExp) => haystack.match(re)?.[1]?.trim();
  return {
    workOrderNumber:
      pick(/\bWork\s*Order[#:\s-]*([A-Z0-9-]{2,})/i) ||
      pick(/\b(?:WO|W\.O\.)[#:\s-]*([A-Z0-9]*\d[A-Z0-9-]*)/i),
    storeNumber: pick(/\bStore[#:\s-]*([A-Z0-9-]{1,})/i),
  };
}
