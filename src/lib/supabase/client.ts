import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemoMode, isSupabaseConfigured } from "@/lib/demo-mode";
import { runLocalTableQuery, type LocalQueryFilter } from "@/lib/local-query";

class BrowserLocalQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: LocalQueryFilter[] = [];
  private sort: { column: string; ascending?: boolean } | undefined;
  private rowLimit: number | undefined;
  private columns = "*";
  private table: string;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*") {
    this.columns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: "in", column, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.sort = { column, ascending: options.ascending };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return runLocalTableQuery({
      table: this.table,
      select: this.columns,
      filters: this.filters,
      order: this.sort,
      limit: this.rowLimit,
    }).then(onfulfilled, onrejected);
  }
}

function createBrowserLocalClient(): SupabaseClient {
  return {
    auth: {
      async signInWithPassword() {
        return { data: { user: null, session: null }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    from(table: string) {
      return new BrowserLocalQuery(table);
    },
  } as unknown as SupabaseClient;
}

export function createClient(): SupabaseClient {
  if (isDemoMode() || !isSupabaseConfigured()) {
    return createBrowserLocalClient();
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as SupabaseClient;
}
