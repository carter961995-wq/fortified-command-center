"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Note } from "../lib/notepad-store";

export function NotepadWorkspace({ notes }: { notes: Note[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter((note) => `${note.title}\n${note.body}`.toLowerCase().includes(needle));
  }, [notes, query]);
  const selected = notes.find((note) => note.id === selectedId) ?? null;

  async function createNote() {
    setMessage("");
    const response = await fetch("/api/notepad", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Could not save the note.");
      return;
    }
    setTitle("");
    setBody("");
    setSelectedId(payload.note.id);
    setMessage("Note saved.");
    router.refresh();
  }

  async function saveSelected(next: { title: string; body: string }) {
    if (!selected) return;
    const response = await fetch(`/api/notepad/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!response.ok) {
      setMessage("Could not update the note.");
      return;
    }
    setMessage("Note updated.");
    router.refresh();
  }

  async function removeSelected() {
    if (!selected) return;
    const response = await fetch(`/api/notepad/${selected.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Could not delete the note.");
      return;
    }
    setSelectedId("");
    setMessage("Note deleted.");
    router.refresh();
  }

  return (
    <div className="mx-auto grid min-w-0 max-w-6xl gap-6">
      <header>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">Notepad</h1>
        <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-400">Call notes, field notes, and follow-ups stay on this computer and come back after a restart.</p>
      </header>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-xl border border-[#223758] bg-[#111f38] p-4">
          <input aria-label="Search notes" placeholder="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="mt-3 grid gap-2">
            {visible.length === 0 ? <p className="text-sm text-slate-400">No notes match that search. Write one on the right and it will stay here.</p> : visible.map((note) => (
              <button className={`rounded-lg px-3 py-2 text-left text-sm font-bold ${note.id === selected?.id ? "bg-orange-500 text-white" : "bg-[#0c172b] text-slate-200"}`} key={note.id} type="button" onClick={() => setSelectedId(note.id)}>
                {note.title || "Untitled note"}
              </button>
            ))}
          </div>
        </aside>
        <section className="grid min-w-0 gap-3 rounded-xl border border-[#223758] bg-[#111f38] p-4">
          {selected ? (
            <NoteEditor key={selected.id} note={selected} onSave={saveSelected} onDelete={removeSelected} />
          ) : (
            <>
              <input aria-label="Note title" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
              <textarea aria-label="Note body" placeholder="Write a note" value={body} onChange={(event) => setBody(event.target.value)} />
              <button className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" type="button" onClick={() => void createNote()}>Save note</button>
            </>
          )}
          {selected ? <button className="justify-self-start text-sm font-black text-slate-300" type="button" onClick={() => setSelectedId("")}>New note</button> : null}
          {message ? <p className="text-sm font-semibold text-orange-200">{message}</p> : null}
        </section>
      </div>
    </div>
  );
}

function NoteEditor({ note, onSave, onDelete }: { note: Note; onSave: (next: { title: string; body: string }) => Promise<void>; onDelete: () => Promise<void> }) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  return (
    <>
      <input aria-label="Edit title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea aria-label="Edit note" value={body} onChange={(event) => setBody(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white" type="button" onClick={() => void onSave({ title, body })}>Save changes</button>
        <button className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-black text-slate-200" type="button" onClick={() => void onDelete()}>Delete</button>
      </div>
    </>
  );
}
