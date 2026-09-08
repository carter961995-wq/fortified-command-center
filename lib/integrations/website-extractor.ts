import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "../supabase/server";
import { geminiConfigured } from "./google";
import { importGptPayload } from "./gpt-bridge";
import { cleanText, normalizeState } from "./gpt-normalize";

export type ExtractedCompany = {
  companyName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  contactName: string;
  services: string[];
  summary: string;
  sourceUrl: string;
};

const TRADE_WORDS = [
  "fence",
  "fencing",
  "gate",
  "gates",
  "welding",
  "weld",
  "railing",
  "bollard",
  "ornamental",
  "chain link",
  "access control",
  "automatic gate",
];

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim());
  }
  return result;
}

function attr(html: string, property: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i"
  );
  return decodeEntities((html.match(pattern)?.[1] || html.match(alt)?.[1] || "").trim());
}

function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function parseJsonLd(html: string): Partial<ExtractedCompany> {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const found: Partial<ExtractedCompany> = {};
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1] ?? "") as Record<string, unknown> | Record<string, unknown>[];
      const nodes = Array.isArray(parsed) ? parsed : [parsed, parsed["@graph"]].flat().filter(Boolean);
      for (const node of nodes as Record<string, unknown>[]) {
        if (!node || typeof node !== "object") continue;
        const type = JSON.stringify(node["@type"] ?? "").toLowerCase();
        if (!type.includes("organization") && !type.includes("localbusiness") && !type.includes("place")) continue;
        found.companyName = cleanText(node.name, found.companyName ?? "");
        found.phone = cleanText(node.telephone, found.phone ?? "");
        found.email = cleanText(node.email, found.email ?? "");
        found.website = cleanText(node.url, found.website ?? "");
        const address = node.address;
        if (address && typeof address === "object") {
          const addr = address as Record<string, unknown>;
          found.address = cleanText(addr.streetAddress, found.address ?? "");
          found.city = cleanText(addr.addressLocality, found.city ?? "");
          found.state = normalizeState(addr.addressRegion) || found.state || "";
          found.zip = cleanText(addr.postalCode, found.zip ?? "");
        } else if (typeof address === "string") {
          found.address = address;
        }
      }
    } catch {
      // Ignore malformed JSON-LD.
    }
  }
  return found;
}

export function extractFromHtml(html: string, sourceUrl = ""): ExtractedCompany {
  const jsonLd = parseJsonLd(html);
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim());
  const companyName =
    jsonLd.companyName ||
    attr(html, "og:site_name") ||
    title.replace(/\s*[|\-–].*$/, "").trim() ||
    "";
  const description = attr(html, "og:description") || attr(html, "description");
  const text = stripHtml(html);
  const emails = unique([
    jsonLd.email || "",
    ...(html.match(/mailto:([^"'>\s?]+)/gi) ?? []).map((item) => item.replace(/^mailto:/i, "")),
    ...(text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? []),
  ]).filter((item) => !item.toLowerCase().includes("example.com"));
  const phones = unique([
    jsonLd.phone || "",
    ...(html.match(/tel:([^"'>\s]+)/gi) ?? []).map((item) => item.replace(/^tel:/i, "")),
    ...(text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g) ?? []),
  ]);
  const services = unique(
    TRADE_WORDS.filter((word) => text.toLowerCase().includes(word)).map((word) =>
      word.replace(/\b\w/g, (letter) => letter.toUpperCase())
    )
  );
  const website = jsonLd.website || sourceUrl || attr(html, "og:url");
  const cityState = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/);

  return {
    companyName,
    phone: phones[0] || "",
    email: emails[0] || "",
    website,
    address: jsonLd.address || "",
    city: jsonLd.city || cityState?.[1] || "",
    state: jsonLd.state || cityState?.[2] || "",
    zip: jsonLd.zip || cityState?.[3] || "",
    contactName: "",
    services,
    summary: description || text.slice(0, 420),
    sourceUrl: sourceUrl || website,
  };
}

export function extractFromText(text: string, sourceUrl = ""): ExtractedCompany {
  const wrapped = `<html><title>${text.slice(0, 80)}</title><body>${text}</body></html>`;
  return extractFromHtml(wrapped, sourceUrl);
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return false;
}

export function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid website address, like https://example.com.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https websites can be extracted.");
  if (isBlockedHost(url.hostname)) throw new Error("That address cannot be fetched from this app.");
  return url.toString();
}

async function fetchWebsiteHtml(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; FortifiedCommandCenter/1.0; +https://fortifiedfence.com)",
      accept: "text/html,application/xhtml+xml,text/plain",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Website returned ${response.status}. Paste the page text instead.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("pdf")) throw new Error("PDF download is not supported here. Paste the text or save as .txt/.html.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 1_500_000) throw new Error("That page is too large. Paste the contact section instead.");
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

async function enrichWithGemini(extracted: ExtractedCompany, sourceText: string) {
  if (!process.env.GEMINI_API_KEY) return { ...extracted, geminiUsed: false };
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const prompt = `Extract a commercial fence/gate lead from this website into JSON with keys:
companyName, phone, email, website, address, city, state, zip, contactName, services (string array), summary.
Use empty strings when unknown. Keep summary to 2-3 sentences about likely fence, gate, or welding work.
Website: ${extracted.sourceUrl}
Text:
${sourceText.slice(0, 14000)}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    if (!response.ok) return { ...extracted, geminiUsed: false };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ...extracted, geminiUsed: false };
    const parsed = JSON.parse(text) as Partial<ExtractedCompany>;
    return {
      companyName: cleanText(parsed.companyName, extracted.companyName),
      phone: cleanText(parsed.phone, extracted.phone),
      email: cleanText(parsed.email, extracted.email),
      website: cleanText(parsed.website, extracted.website),
      address: cleanText(parsed.address, extracted.address),
      city: cleanText(parsed.city, extracted.city),
      state: normalizeState(parsed.state) || extracted.state,
      zip: cleanText(parsed.zip, extracted.zip),
      contactName: cleanText(parsed.contactName, extracted.contactName),
      services: Array.isArray(parsed.services) && parsed.services.length ? parsed.services.map(String) : extracted.services,
      summary: cleanText(parsed.summary, extracted.summary),
      sourceUrl: extracted.sourceUrl,
      geminiUsed: true,
    };
  } catch {
    return { ...extracted, geminiUsed: false };
  }
}

export async function extractWebsite(input: { url?: string; html?: string; text?: string }) {
  const sourceUrl = input.url ? normalizeWebsiteUrl(input.url) : "";
  let html = input.html?.trim() || "";
  if (!html && sourceUrl) html = await fetchWebsiteHtml(sourceUrl);
  const extracted = html
    ? extractFromHtml(html, sourceUrl)
    : extractFromText(input.text ?? "", sourceUrl);
  if (!html && !input.text?.trim() && !sourceUrl) {
    throw new Error("Enter a website URL, paste page text, or upload a file.");
  }
  const sourceText = html ? stripHtml(html) : input.text ?? "";
  const enriched = await enrichWithGemini(extracted, sourceText);
  return {
    ...enriched,
    geminiConfigured: geminiConfigured(),
  };
}

export async function saveExtractedCompany(input: ExtractedCompany & { as?: "lead" | "customer" }) {
  const companyName = cleanText(input.companyName);
  if (!companyName) throw new Error("Company name is required before saving.");
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("Command Center data store is not available.");
  const asLead = (input.as ?? "lead") !== "customer";
  const address = [input.address, input.city, input.state, input.zip].filter(Boolean).join(", ");
  const notes = [
    input.summary,
    input.services.length ? `Services: ${input.services.join(", ")}` : "",
    input.sourceUrl ? `Website: ${input.sourceUrl}` : input.website ? `Website: ${input.website}` : "",
    "Created from Website Extractor.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await importGptPayload(supabase, {
    customers: [
      {
        externalId: input.sourceUrl || input.website || companyName,
        companyName,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        billingAddress: address,
        customerType: "commercial",
        status: asLead ? "prospect" : "active",
        notes,
      },
    ],
  });

  revalidatePath("/clients");
  revalidatePath("/customers");
  revalidatePath("/leads");
  revalidatePath("/website-extractor");
  return { ...result, as: asLead ? "lead" : "customer" };
}
