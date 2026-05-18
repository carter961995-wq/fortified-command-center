import { NextResponse } from "next/server";
import {
  ACTIVE_OPERATIONAL_STATES,
  type AiSourcingRecommendation,
  type OperationalState,
} from "@/lib/subcontractors/command-map-types";
import { isOperationalState } from "@/lib/subcontractors/geo";

export const runtime = "nodejs";

interface SourceSubcontractorsRequest {
  query?: string;
  activeStates?: string[];
  existingSubcontractors?: Array<{
    companyName?: string;
    city?: string;
    state?: string;
    service_radius?: number;
    skills?: string[];
  }>;
}

interface OpenAiResponsePayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

interface PerplexityPayload {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeState(value: unknown): OperationalState | undefined {
  const state = asString(value).toUpperCase();
  return isOperationalState(state) ? state : undefined;
}

function extractJsonPayload(text: string) {
  const fencedJson = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = fencedJson ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain JSON");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function normalizeRecommendations(payload: unknown): AiSourcingRecommendation[] {
  const root = payload as {
    recommendations?: unknown;
    results?: unknown;
  };
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(root.recommendations)
      ? root.recommendations
      : Array.isArray(root.results)
        ? root.results
        : [];

  return items
    .map((item, index) => {
      const record = item as Record<string, unknown>;
      const companyName =
        asString(record.companyName) ||
        asString(record.company_name) ||
        asString(record.name);

      if (!companyName) return null;

      const skills = Array.isArray(record.skills)
        ? record.skills.map(asString).filter(Boolean)
        : asString(record.skills)
          ? asString(record.skills)
              .split(",")
              .map((skill) => skill.trim())
              .filter(Boolean)
          : undefined;

      return {
        id: asString(record.id) || `ai-rec-${index + 1}`,
        companyName,
        phone:
          asString(record.phone) ||
          asString(record.estimatedPhone) ||
          asString(record.estimated_phone) ||
          "Phone not found",
        website:
          asString(record.website) ||
          asString(record.url) ||
          asString(record.sourceUrl) ||
          "",
        proximity:
          asString(record.proximity) ||
          asString(record.distance) ||
          "Local proximity needs verification",
        city: asString(record.city) || undefined,
        state: normalizeState(record.state),
        lat: typeof record.lat === "number" ? record.lat : undefined,
        lng: typeof record.lng === "number" ? record.lng : undefined,
        skills,
        summary: asString(record.summary) || asString(record.notes) || undefined,
        confidence:
          asString(record.confidence).toLowerCase() === "high" ||
          asString(record.confidence).toLowerCase() === "medium" ||
          asString(record.confidence).toLowerCase() === "low"
            ? (asString(record.confidence).toLowerCase() as "high" | "medium" | "low")
            : "medium",
      } satisfies AiSourcingRecommendation;
    })
    .filter((item): item is AiSourcingRecommendation => Boolean(item))
    .slice(0, 6);
}

function buildPrompt(body: SourceSubcontractorsRequest) {
  const states = (body.activeStates?.length ? body.activeStates : ACTIVE_OPERATIONAL_STATES)
    .filter((state) => ACTIVE_OPERATIONAL_STATES.includes(state as OperationalState))
    .join(", ");
  const existingSubcontractors = JSON.stringify(
    (body.existingSubcontractors ?? []).slice(0, 25),
    null,
    2
  );

  return `Search live web sources, local contractor directories, company websites, and map-style business listings for subcontractors matching this sourcing request:
"${body.query}"

Operational states: ${states}.
Existing active subcontractors to avoid duplicating:
${existingSubcontractors}

Return only strict JSON with this shape:
{
  "recommendations": [
    {
      "companyName": "Business name",
      "phone": "estimated phone or Phone not found",
      "website": "business website or source URL",
      "proximity": "estimated proximity to the requested city/area",
      "city": "city if known",
      "state": "two-letter state",
      "skills": ["trade skill"],
      "summary": "why this contractor appears relevant",
      "confidence": "high|medium|low"
    }
  ]
}

Only include companies that appear to perform commercial fence, welding, gate automation, ironwork, security grille, bollard, or closely related facilities maintenance work.`;
}

async function callPerplexity(prompt: string) {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL ?? "sonar-pro",
      temperature: 0.2,
      max_tokens: 1600,
      messages: [
        {
          role: "system",
          content:
            "You are a subcontractor sourcing analyst. Use live web search and return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity sourcing failed with ${response.status}`);
  }

  const payload = (await response.json()) as PerplexityPayload;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Perplexity returned an empty response");

  return content;
}

function getOpenAiOutputText(payload: OpenAiResponsePayload) {
  if (payload.output_text) return payload.output_text;

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text))
      .join("\n") ?? ""
  );
}

async function callOpenAi(prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SOURCING_MODEL ?? "gpt-4.1-mini",
      tools: [{ type: "web_search_preview" }],
      input: `You are a subcontractor sourcing analyst. Use web search and return only valid JSON.\n\n${prompt}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI sourcing failed with ${response.status}`);
  }

  const payload = (await response.json()) as OpenAiResponsePayload;
  const text = getOpenAiOutputText(payload);
  if (!text) throw new Error("OpenAI returned an empty response");

  return text;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SourceSubcontractorsRequest;
  const query = asString(body.query);

  if (query.length < 6) {
    return NextResponse.json(
      { error: "Enter a trade and city/state before sourcing subcontractors." },
      { status: 400 }
    );
  }

  const prompt = buildPrompt({ ...body, query });

  try {
    const responseText = process.env.PERPLEXITY_API_KEY
      ? await callPerplexity(prompt)
      : process.env.OPENAI_API_KEY
        ? await callOpenAi(prompt)
        : "";

    if (!responseText) {
      return NextResponse.json(
        {
          recommendations: [],
          error:
            "AI sourcing is not configured. Set PERPLEXITY_API_KEY or OPENAI_API_KEY on the server.",
        },
        { status: 503 }
      );
    }

    const parsed = extractJsonPayload(responseText);
    const recommendations = normalizeRecommendations(parsed);

    return NextResponse.json({ recommendations });
  } catch (error) {
    return NextResponse.json(
      {
        recommendations: [],
        error: error instanceof Error ? error.message : "AI sourcing failed",
      },
      { status: 502 }
    );
  }
}
