import { revalidatePath } from "next/cache";
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
  saveGptPublicBaseUrl,
  gptPublicOrigin,
  snapshotGpt,
  updateBusinessProfile,
  upsertCompanyKnowledge,
  writeGptPayload,
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

function revalidateCommandCenter() {
  revalidatePath("/subcontractor-map");
  revalidatePath("/clients");
  revalidatePath("/customers");
  revalidatePath("/jobs");
  revalidatePath("/work-orders");
  revalidatePath("/subcontractors");
  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/fence-bible");
  revalidatePath("/website-extractor");
  revalidatePath("/settings");
}

export async function handleGptRequest(request: Request, slug: string[] = []) {
  const path = slug.join("/");
  if (request.method === "OPTIONS") return OPTIONS();

  if (path === "openapi" || path === "openapi.json") {
    const store = await loadGptStore();
    return json(gptOpenApiSpec(gptPublicOrigin(store, request)));
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
      revalidateCommandCenter();
      return json({ ok: true, ...result });
    }
    if ((path === "update" || path === "write") && (request.method === "POST" || request.method === "PATCH")) {
      const payload = (await request.json()) as Record<string, unknown>;
      const result = await writeGptPayload(supabase, payload);
      revalidateCommandCenter();
      return json({ ok: true, ...result });
    }
    if (path === "dispatch" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, unknown>;
      const result = await dispatchWorkOrder(supabase, payload);
      revalidateCommandCenter();
      return json({ ok: true, ...result });
    }
    if (path === "knowledge" && request.method === "GET") {
      const current = await loadGptStore();
      return json({ ok: true, business: current.business, knowledge: current.knowledge });
    }
    if (path === "knowledge" && (request.method === "POST" || request.method === "PATCH")) {
      const payload = (await request.json()) as Record<string, unknown>;
      const result = await upsertCompanyKnowledge(payload);
      revalidateCommandCenter();
      return json({ ok: true, ...result });
    }
    if ((path === "business" || path === "profile") && request.method === "GET") {
      const current = await loadGptStore();
      return json({ ok: true, business: current.business, knowledge: current.knowledge });
    }
    if ((path === "business" || path === "profile") && (request.method === "POST" || request.method === "PATCH")) {
      const payload = (await request.json()) as Record<string, unknown>;
      const business =
        payload.business && typeof payload.business === "object"
          ? (payload.business as Record<string, unknown>)
          : payload;
      const result = await updateBusinessProfile(business);
      revalidateCommandCenter();
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
    const body = (await request.json().catch(() => ({}))) as { action?: string; publicBaseUrl?: string };
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
    if (body.action === "savePublicUrl") {
      const store = await saveGptPublicBaseUrl(body.publicBaseUrl ?? "");
      const origin = gptPublicOrigin(store, request);
      return json({
        ok: true,
        publicBaseUrl: store.publicBaseUrl ?? "",
        openApiUrl: `${origin}/api/gpt/v1/openapi`,
        importUrl: `${origin}/api/gpt/v1/import`,
        snapshotUrl: `${origin}/api/gpt/v1/snapshot`,
        knowledgeUrl: `${origin}/api/gpt/v1/knowledge`,
        updateUrl: `${origin}/api/gpt/v1/update`,
        businessUrl: `${origin}/api/gpt/v1/business`,
      });
    }
    if (body.action === "test") {
      const supabase = await requireBridgeClient();
      const snap = await snapshotGpt(supabase);
      return json({
        ok: true,
        tested: true,
        demoMode: isDemoMode(),
        counts: snap.counts,
        knowledge: snap.knowledge.length,
        business: snap.business.companyName || null,
      });
    }
  }

  const ensured = await ensureGptApiKey();
  const origin = gptPublicOrigin(ensured.store, request);
  const localOrigin = new URL(request.url).origin;
  const key = configuredGptApiKey(ensured.store);
  const localhost = /localhost|127\.0\.0\.1/.test(origin);
  return json({
    ok: true,
    demoMode: isDemoMode(),
    envOverrides: Boolean(process.env.FORTIFIED_GPT_API_KEY),
    hasKey: Boolean(key),
    apiKey: key,
    keyPreview: key ? `…${key.slice(-4)}` : null,
    publicBaseUrl: ensured.store.publicBaseUrl ?? "",
    localOrigin,
    chatGptReady: !localhost && origin.startsWith("https://"),
    openApiUrl: `${origin}/api/gpt/v1/openapi`,
    importUrl: `${origin}/api/gpt/v1/import`,
    snapshotUrl: `${origin}/api/gpt/v1/snapshot`,
    knowledgeUrl: `${origin}/api/gpt/v1/knowledge`,
    updateUrl: `${origin}/api/gpt/v1/update`,
    businessUrl: `${origin}/api/gpt/v1/business`,
    instructions: gptCustomInstructions(),
    importLog: ensured.store.importLog.slice(0, 8),
    knowledgeCount: ensured.store.knowledge.length,
    business: ensured.store.business,
  });
}
