"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/require-staff";
import { createAdminClient } from "@/lib/supabase/admin";

export async function uploadWorkOrderFile(formData: FormData): Promise<void> {
  await requireStaff();
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const kind = String(formData.get("kind") ?? "photo");
  const file = formData.get("file") as File | null;
  if (!workOrderId || !file || file.size === 0) return;

  const admin = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${workOrderId}/${Date.now()}-${safeName}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("work-order-files").upload(path, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) return;

  const {
    data: { publicUrl },
  } = admin.storage.from("work-order-files").getPublicUrl(path);

  const { supabase } = await requireStaff();
  if (kind === "document") {
    const { error } = await supabase.from("work_order_documents").insert({
      work_order_id: workOrderId,
      document_url: publicUrl,
      document_type: String(formData.get("document_type") ?? "other"),
      filename: file.name,
      uploaded_by: "admin",
    });
    if (error) return;
  } else {
    const { error } = await supabase.from("work_order_photos").insert({
      work_order_id: workOrderId,
      photo_url: publicUrl,
      photo_type: String(formData.get("photo_type") ?? "other"),
      caption: (formData.get("caption") as string) || null,
      uploaded_by: "admin",
    });
    if (error) return;
  }

  revalidatePath(`/work-orders/${workOrderId}`);
}
