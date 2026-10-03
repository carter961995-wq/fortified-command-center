import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "../../../../../lib/env";
import { saveLocalUpload, validateUpload } from "../../../../../lib/local-uploads";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse("Supabase is not configured.", { status: 500 });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  const type = String(form.get("type") ?? "");
  const caption = String(form.get("caption") ?? "");
  const upload = form.get("file");
  if (!(upload instanceof File) || !kind || !type) return new NextResponse("Choose a file to upload.", { status: 400 });

  const bytes = new Uint8Array(await upload.arrayBuffer());
  const checked = validateUpload({ filename: upload.name, mimeType: upload.type || "application/octet-stream", size: bytes.byteLength });
  if (!checked.ok) return new NextResponse(checked.error, { status: 400 });

  let url = "";
  if (isSupabaseConfigured()) {
    const bucket = kind === "photo" ? "work-order-photos" : "work-order-documents";
    const storagePath = `${id}/${crypto.randomUUID()}-${checked.filename}`;
    const uploaded = await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType: upload.type, upsert: false });
    if (uploaded.error || !uploaded.data) return new NextResponse(uploaded.error?.message || "The file was not stored.", { status: 400 });
    url = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
    if (!url || url.includes("/demo-files/")) return new NextResponse("The file was not stored.", { status: 400 });
  } else {
    const saved = await saveLocalUpload({ workOrderId: id, filename: checked.filename, mimeType: upload.type, bytes });
    if (!saved.ok) return new NextResponse(saved.error, { status: 400 });
    url = saved.url;
  }

  if (kind === "photo") {
    const { error } = await supabase.from("work_order_photos").insert({
      work_order_id: id,
      photo_url: url,
      photo_type: type,
      caption: caption || checked.filename,
      uploaded_by: userData.user.id,
    });
    if (error) return new NextResponse(error.message, { status: 400 });
  } else if (kind === "document") {
    const { error } = await supabase.from("work_order_documents").insert({
      work_order_id: id,
      document_url: url,
      document_type: type,
      filename: checked.filename,
      uploaded_by: userData.user.id,
    });
    if (error) return new NextResponse(error.message, { status: 400 });
  } else {
    return new NextResponse("Unknown file kind.", { status: 400 });
  }

  return NextResponse.json({ ok: true, url });
}
