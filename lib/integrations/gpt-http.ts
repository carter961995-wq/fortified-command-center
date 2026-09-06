import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../supabase/server";
import { getSessionContext } from "../data";
import { isDemoMode } from "../env";
import {
  configuredGptApiKey,
  dispatchWorkOrder,
  ensureGptApiKey,
  gptKeyMatches,
  importGptPayload,
  loadGptStore,
  rotateGptApiKey,
  snapshotGpt,
  upsertKnowledge,
} from "./gpt-bridge";
import { gptCustomInstructions, gptOpenApiSpec } from "./gpt-openapi";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key, X-Fortified-Key",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  };
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

async function requireBridgeClient() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("Command Center data store is not available.");
  return supabase;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function handleGptRequest(request: Request, slug: string[] = []) {
  const path = slug.join("/");
  if (request.method === "OPTIONS") return OPTIONS();

  if (path === "openapi" || path === "openapi.json") {
    const origin = new URL(request.url).origin;
    return json(gptOpenApiSpec(origin));
  }

  if (path === "settings") {
    return handleSettings(request);
  }

  const store = await loadGptStore();
  if (!configuredGptApiKey(store)) {
    await ensureGptApiKey();
  }
  const latest = await loadGptStore();
  if (!gptKeyMatches(request, latest)) {
    return json({ ok: false, error: "Missing or invalid Fortified GPT API key." }, 401);
  }

  try {
    const supabase = await requireBridgeClient();
    if (path === "health" || path === "") {
      return json({ ok: true, service: "fortified-gpt-bridge", demoMode: isDemoMode() });
    }
    if (path === "snapshot" && request.method === "GET") {
      return json({ ok: true, ...(await snapshotGpt(supabase)) });
    }
    if (path === "import" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, unknown>;
      const result = await importGptPayload(supabase, payload);
      return json({ ok: true, ...result });
    }
    if (path === "dispatch" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, unknown>;
      const result = await dispatchWorkOrder(supabase, payload);
      return json({ ok: true, ...result });
    }
    if (path === "knowledge" && request.method === "GET") {
      const current = await loadGptStore();
      return json({ ok: true, business: current.business, knowledge: current.knowledge });
    }
    if (path === "knowledge" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, unknown>;
      const entries = Array.isArray(payload.entries) ? payload.entries : [payload];
      const result = await upsertKnowledge(entries);
      return json({ ok: true, ...result });
    }
    return json({ ok: false, error: `Unknown GPT bridge path: ${path || "/"}` }, 404);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "GPT bridge failed." }, 400);
  }
}

async function handleSettings(request: Request) {
  if (!isDemoMode()) {
    const { user } = await getSessionContext();
    if (!user) return json({ ok: false, error: "Sign in required." }, 401);
  }

  if (request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action === "rotate") {
      const rotated = await rotateGptApiKey();
      return json({
        ok: true,
        apiKey: rotated.envOverrides ? configuredGptApiKey(rotated.store) : rotated.apiKey,
        envOverrides: rotated.envOverrides,
        warning: rotated.envOverrides
          ? "FORTIFIED_GPT_API_KEY is set, so the environment key is still the live credential."
          : null,
      });
    }
  }

  const ensured = await ensureGptApiKey();
  const origin = new URL(request.url).origin;
  const key = configuredGptApiKey(ensured.store);
  return json({
    ok: true,
    demoMode: isDemoMode(),
    envOverrides: Boolean(process.env.FORTIFIED_GPT_API_KEY),
    hasKey: Boolean(key),
    apiKey: key,
    keyPreview: key ? `…${key.slice(-4)}` : null,
    openApiUrl: `${origin}/api/gpt/v1/openapi`,
    importUrl: `${origin}/api/gpt/v1/import`,
    snapshotUrl: `${origin}/api/gpt/v1/snapshot`,
    instructions: gptCustomInstructions(),
    importLog: ensured.store.importLog.slice(0, 8),
    knowledgeCount: ensured.store.knowledge.length,
    business: ensured.store.business,
  });
}
