import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse("Supabase is not configured.", { status: 500 });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as { kind?: string; url?: string; type?: string; caption?: string; filename?: string };
  if (!body.url || !body.kind || !body.type) return new NextResponse("Missing file metadata.", { status: 400 });

  if (body.kind === "photo") {
    const { error } = await supabase.from("work_order_photos").insert({
      work_order_id: id,
      photo_url: body.url,
      photo_type: body.type,
      caption: body.caption || null,
      uploaded_by: userData.user.id
    });
    if (error) return new NextResponse(error.message, { status: 400 });
  } else {
    const { error } = await supabase.from("work_order_documents").insert({
      work_order_id: id,
      document_url: body.url,
      document_type: body.type,
      filename: body.filename || "document",
      uploaded_by: userData.user.id
    });
    if (error) return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
