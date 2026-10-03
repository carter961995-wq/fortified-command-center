"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlainRow } from "../lib/business";

export function DocumentsWorkspace({
  documents,
  photos,
  error,
  query,
}: {
  documents: PlainRow[];
  photos: PlainRow[];
  error?: string;
  query: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(error ?? "");
  const [workOrderId, setWorkOrderId] = useState("");
  const rows = [
    ...documents.map((row) => ({
      id: String(row.id),
      name: String(row.filename ?? "Document"),
      type: String(row.document_type ?? "document"),
      url: String(row.document_url ?? ""),
      workOrderId: String(row.work_order_id ?? ""),
    })),
    ...photos.map((row) => ({
      id: String(row.id),
      name: String(row.caption ?? row.filename ?? "Photo"),
      type: String(row.photo_type ?? "photo"),
      url: String(row.photo_url ?? ""),
      workOrderId: String(row.work_order_id ?? ""),
    })),
  ].filter((row) => row.url && !row.url.includes("/demo-files/"));

  async function upload(formData: FormData) {
    setMessage("");
    const id = String(formData.get("workOrderId") ?? "").trim();
    const file = formData.get("file");
    if (!id || !(file instanceof File) || file.size === 0) {
      setMessage("Choose a work order and a JPEG, PNG, GIF, WebP, or PDF.");
      return;
    }
    formData.set("kind", "document");
    formData.set("type", "other");
    const response = await fetch(`/api/work-orders/${id}/files`, { method: "POST", body: formData });
    if (!response.ok) {
      setMessage(await response.text());
      return;
    }
    setMessage("File saved.");
    router.refresh();
  }

  return (
    <div className="mx-auto grid min-w-0 max-w-6xl gap-6">
      <header>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">Documents</h1>
        <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-400">Browse, search, and open files already linked to work orders. Uploads stay attached to the job you choose.</p>
      </header>
      <form className="grid gap-3 rounded-xl border border-[#223758] bg-[#111f38] p-4 md:grid-cols-[1fr_auto]" action={`/${"documents"}`}>
        <input name="q" aria-label="Search documents" placeholder="Search by file name or type" defaultValue={query} />
        <button className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" type="submit">Search</button>
      </form>
      <form action={upload} className="grid gap-3 rounded-xl border border-[#223758] bg-[#111f38] p-4 md:grid-cols-3">
        <input name="workOrderId" aria-label="Work order id" placeholder="Work order id" value={workOrderId} onChange={(event) => setWorkOrderId(event.target.value)} required />
        <input name="file" aria-label="Upload file" type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" required />
        <button className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" type="submit">Upload</button>
      </form>
      {message ? <p className="text-sm font-semibold text-orange-200">{message}</p> : null}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#223758] bg-[#111f38] p-6 text-sm text-slate-300">
          No stored files match this search. Upload a photo or PDF on a work order, or paste that work order id above.
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#223758] bg-[#111f38] p-4" key={row.id}>
              <div className="min-w-0">
                <p className="truncate font-black text-white">{row.name}</p>
                <p className="text-xs font-semibold uppercase text-slate-400">{row.type}</p>
              </div>
              <div className="flex gap-3 text-sm font-black">
                <a className="text-orange-300" href={row.url} target="_blank" rel="noreferrer">Open</a>
                {row.workOrderId ? <Link className="text-slate-200" href={`/work-orders/${row.workOrderId}`}>Job</Link> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
