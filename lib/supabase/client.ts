"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isDemoMode } from "../env";

export function createSupabaseBrowserClient(): SupabaseClient {
  if (isDemoMode()) {
    return {
      auth: {
        async signInWithPassword() {
          return { data: null, error: null };
        },
        async signOut() {
          return { error: null };
        }
      }
    } as unknown as SupabaseClient;
  }

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) throw new Error("Supabase browser client is not configured.");
  return createBrowserClient(url, anonKey) as SupabaseClient;
}
