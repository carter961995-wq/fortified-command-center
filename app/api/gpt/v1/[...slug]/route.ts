import { handleGptRequest, OPTIONS } from "../../../../../lib/integrations/gpt-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { OPTIONS };

export async function GET(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params;
  return handleGptRequest(request, slug);
}

export async function POST(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params;
  return handleGptRequest(request, slug);
}

export async function PATCH(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params;
  return handleGptRequest(request, slug);
}
