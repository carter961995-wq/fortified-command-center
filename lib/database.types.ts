// Lightweight Supabase type anchor for this recovered MVP.
// Regenerate with `supabase gen types typescript --project-id <ref> > lib/database.types.ts` after applying migrations.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, {
      Row: Record<string, Json>;
      Insert: Record<string, Json | undefined>;
      Update: Record<string, Json | undefined>;
      Relationships: unknown[];
    }>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
