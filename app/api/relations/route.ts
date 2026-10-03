import { NextResponse } from "next/server";
import { searchRelationOptions } from "../../../lib/data";

const relations: Record<string, { table: string; value: string; label: string }> = {
  customers: { table: "customers", value: "id", label: "company_name" },
  locations: { table: "locations", value: "id", label: "location_name" },
  subcontractors: { table: "subcontractors", value: "id", label: "company_name" },
  work_orders: { table: "work_orders", value: "id", label: "title" },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const table = url.searchParams.get("table") ?? "";
  const relation = relations[table];
  if (!relation) return NextResponse.json({ options: [] }, { status: 400 });
  const options = await searchRelationOptions(relation, url.searchParams.get("q") ?? "", url.searchParams.get("selected") ?? undefined);
  return NextResponse.json({ options });
}
