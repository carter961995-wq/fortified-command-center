import { handleFenceBible } from "../../../../lib/integrations/fence-bible-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleFenceBible(request);
}

export async function POST(request: Request) {
  return handleFenceBible(request);
}
