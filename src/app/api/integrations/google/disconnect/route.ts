import { NextResponse } from "next/server";
import { deleteGoogleConnection } from "../../../../../../lib/integrations/google";

export async function POST() {
  await deleteGoogleConnection();
  return NextResponse.json({ ok: true });
}
