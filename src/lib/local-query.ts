"use server";

import { createClient } from "@/lib/supabase/server";

export type LocalQueryFilter = {
  type: "eq" | "in";
  column: string;
  value: unknown;
};

export type LocalQueryInput = {
  table: string;
  select?: string;
  filters?: LocalQueryFilter[];
  order?: { column: string; ascending?: boolean };
  limit?: number;
};

export async function runLocalTableQuery(input: LocalQueryInput) {
  const supabase = await createClient();
  let query = supabase.from(input.table).select(input.select || "*");
  for (const filter of input.filters ?? []) {
    if (filter.type === "eq") query = query.eq(filter.column, filter.value);
    if (filter.type === "in") query = query.in(filter.column, filter.value as unknown[]);
  }
  if (input.order) {
    query = query.order(input.order.column, { ascending: input.order.ascending ?? true });
  }
  if (input.limit) query = query.limit(input.limit);
  const { data, error } = await query;
  return { data: data ?? [], error };
}
