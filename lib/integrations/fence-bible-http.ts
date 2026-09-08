import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionContext } from "../data";
import { isDemoMode } from "../env";
import {
  deleteKnowledge,
  loadGptStore,
  updateBusinessProfile,
  upsertCompanyKnowledge,
  type BusinessProfile,
  type KnowledgeEntry,
} from "./gpt-bridge";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function requireWorkspace() {
  if (isDemoMode()) return true;
  const { user } = await getSessionContext();
  if (!user) return false;
  return true;
}

function revalidateBible() {
  revalidatePath("/fence-bible");
  revalidatePath("/settings");
}

export async function handleFenceBible(request: Request) {
  if (!(await requireWorkspace())) {
    return json({ ok: false, error: "Sign in required." }, 401);
  }

  if (request.method === "GET") {
    const store = await loadGptStore();
    return json({
      ok: true,
      business: store.business,
      knowledge: store.knowledge,
    });
  }

  try {
    const body = (await request.json()) as Record<string, unknown> & {
      action?: string;
      id?: string;
      business?: BusinessProfile;
      entry?: KnowledgeEntry;
    };
    if (body.action === "delete" && body.id) {
      const result = await deleteKnowledge(String(body.id));
      revalidateBible();
      return json({ ok: true, ...result });
    }
    if (body.action === "business" || body.business) {
      const result = await updateBusinessProfile((body.business ?? body) as Record<string, unknown>);
      revalidateBible();
      return json({ ok: true, ...result });
    }
    const payload = (body.entry ?? body) as Record<string, unknown>;
    const result = await upsertCompanyKnowledge(payload);
    revalidateBible();
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Fence Bible save failed." }, 400);
  }
}
