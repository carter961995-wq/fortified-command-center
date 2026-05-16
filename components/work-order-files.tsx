"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { displayValue, type PlainRow } from "@/lib/business";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const photoTypes = ["before", "during", "after", "receipt", "damage", "other"];
const documentTypes = ["quote", "invoice", "receipt", "completion_form", "contract", "other"];

function FileList({ title, rows, urlKey, typeKey }: { title: string; rows: PlainRow[]; urlKey: string; typeKey: string }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {rows.length ? (
        <div className="grid gap-3">
          {rows.map((row) => (
            <a className="rounded-xl border border-stone-200 bg-stone-50 p-3 hover:bg-amber-50" href={String(row[urlKey])} key={String(row.id)} rel="noreferrer" target="_blank">
              <div className="flex items-center justify-between gap-3"><Badge>{displayValue(row, typeKey)}</Badge><span className="text-xs font-bold text-stone-500">{displayValue(row, "filename")}</span></div>
              <p className="mt-2 text-sm text-stone-700">{displayValue(row, "caption")}</p>
            </a>
          ))}
        </div>
      ) : <p className="text-sm text-stone-500">No files uploaded yet.</p>}
    </Card>
  );
}

export function WorkOrderFiles({ workOrderId, photos, documents }: { workOrderId: string; photos: PlainRow[]; documents: PlainRow[] }) {
  const [kind, setKind] = useState<"photo" | "document">("photo");
  const [fileType, setFileType] = useState("before");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function upload() {
    if (!file) {
      setMessage("Choose a file first.");
      return;
    }
    setMessage("");
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const bucket = kind === "photo" ? "work-order-photos" : "work-order-documents";
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${workOrderId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        const response = await fetch(`/api/work-orders/${workOrderId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, url: data.publicUrl, type: fileType, caption, filename: file.name })
        });
        if (!response.ok) throw new Error(await response.text());
        setCaption("");
        setFile(null);
        setMessage("Upload saved.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      }
    });
  }

  const typeOptions = kind === "photo" ? photoTypes : documentTypes;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="xl:col-span-2">
        <h2 className="text-lg font-black">Photos and documents</h2>
        <p className="mt-1 text-sm text-stone-600">Files upload to Supabase Storage buckets and are linked to this work order for field photos, receipts, quotes, invoices, completion forms, and contracts.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <select value={kind} onChange={(event) => { const next = event.target.value as "photo" | "document"; setKind(next); setFileType(next === "photo" ? "before" : "quote"); }}><option value="photo">Photo</option><option value="document">Document</option></select>
          <select value={fileType} onChange={(event) => setFileType(event.target.value)}>{typeOptions.map((type) => <option key={type}>{type}</option>)}</select>
          <input className="md:col-span-2" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60" disabled={isPending} type="button" onClick={upload}>{isPending ? "Uploading..." : "Upload"}</button>
          <input className="md:col-span-5" placeholder="Caption or note" value={caption} onChange={(event) => setCaption(event.target.value)} />
        </div>
        {message ? <p className="mt-3 text-sm font-semibold text-stone-700">{message}</p> : null}
      </Card>
      <FileList title="Photos" rows={photos} urlKey="photo_url" typeKey="photo_type" />
      <FileList title="Documents" rows={documents} urlKey="document_url" typeKey="document_type" />
    </div>
  );
}
