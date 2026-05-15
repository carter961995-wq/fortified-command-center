/** Supabase nested selects may return a single object or a one-element array depending on typing. */
export function unwrapEmbed<T>(v: unknown): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return (v[0] as T | undefined) ?? null;
  return v as T;
}
