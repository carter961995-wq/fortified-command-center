import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { userDataDir } from "./file-lock.ts";

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

function notesPath() {
  return path.join(userDataDir(), "notepad.json");
}

async function readNotes(): Promise<Note[]> {
  try {
    const parsed = JSON.parse(await readFile(notesPath(), "utf8")) as { notes?: Note[] };
    return Array.isArray(parsed.notes) ? parsed.notes : [];
  } catch {
    return [];
  }
}

async function writeNotes(notes: Note[]) {
  await mkdir(userDataDir(), { recursive: true });
  await writeFile(notesPath(), JSON.stringify({ notes }, null, 2));
}

export async function listNotes(query = "") {
  const needle = query.trim().toLowerCase();
  const notes = (await readNotes()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!needle) return notes;
  return notes.filter((note) => `${note.title}\n${note.body}`.toLowerCase().includes(needle));
}

export async function createNote(input: { title?: string; body?: string }) {
  const now = new Date().toISOString();
  const note: Note = {
    id: randomUUID(),
    title: (input.title || "Untitled note").trim().slice(0, 160),
    body: (input.body || "").slice(0, 20000),
    createdAt: now,
    updatedAt: now,
  };
  const notes = await readNotes();
  notes.push(note);
  await writeNotes(notes);
  return note;
}

export async function updateNote(id: string, input: { title?: string; body?: string }) {
  const notes = await readNotes();
  const note = notes.find((item) => item.id === id);
  if (!note) return null;
  if (input.title !== undefined) note.title = input.title.trim().slice(0, 160) || "Untitled note";
  if (input.body !== undefined) note.body = input.body.slice(0, 20000);
  note.updatedAt = new Date().toISOString();
  await writeNotes(notes);
  return note;
}

export async function deleteNote(id: string) {
  const notes = await readNotes();
  const next = notes.filter((item) => item.id !== id);
  if (next.length === notes.length) return false;
  await writeNotes(next);
  return true;
}
