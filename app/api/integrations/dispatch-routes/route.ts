import { NextResponse } from "next/server";
import { isDemoMode } from "../../../../lib/env";
import {
  loadDispatchRoutes,
  normalizeDispatchRoute,
  saveDispatchRoutes,
  type DispatchRoute,
} from "../../../../lib/integrations/dispatch-monitor";
import { toContractorCandidate } from "../../../../lib/integrations/contractor-match";

async function loadContractors() {
  const { createSupabaseServerClient } = await import("../../../../lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("subcontractors").select("*");
  return ((data ?? []) as Record<string, unknown>[]).map(toContractorCandidate).filter((row) => row.id);
}

export async function GET() {
  const [routes, contractors] = await Promise.all([loadDispatchRoutes(), loadContractors()]);
  return NextResponse.json({ ok: true, routes, contractors, demoMode: isDemoMode() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "save" | "delete";
      id?: string;
      route?: Partial<DispatchRoute> & { subcontractorId?: string };
    };
    const routes = await loadDispatchRoutes();

    if (body.action === "delete") {
      const next = routes.filter((route) => route.id !== body.id);
      await saveDispatchRoutes(next);
      return NextResponse.json({ ok: true, routes: next });
    }

    if (!body.route?.subcontractorId) {
      return NextResponse.json({ ok: false, error: "Choose the contractor for this location." }, { status: 400 });
    }
    const route = normalizeDispatchRoute({ ...body.route, subcontractorId: body.route.subcontractorId });
    if (!route.states.length && !route.cities.length && !route.zipPrefixes.length) {
      return NextResponse.json(
        { ok: false, error: "Add at least one state, city, or ZIP prefix so the route matches a job location." },
        { status: 400 }
      );
    }
    const next = routes.some((item) => item.id === route.id)
      ? routes.map((item) => (item.id === route.id ? route : item))
      : [route, ...routes];
    await saveDispatchRoutes(next);
    return NextResponse.json({ ok: true, routes: next, route });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not save the dispatch route." },
      { status: 400 }
    );
  }
}
