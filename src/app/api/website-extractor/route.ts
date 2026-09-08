import { handleWebsiteExtractor } from "../../../../lib/integrations/website-extractor-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleWebsiteExtractor(request);
}
