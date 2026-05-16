"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { displayValue, formatDate, money, percent, type PlainRow } from "@/lib/business";
import type { ListColumn } from "@/lib/schema";

function formatCell(row: PlainRow, column: ListColumn) {
  const value = displayValue(row, column.key);
  if (column.type === "money") return money(value === "-" ? 0 : value);
  if (column.type === "date") return formatDate(value);
  if (column.type === "percent") return percent(value);
  if (column.type === "boolean") return value;
  if (column.type === "status" || column.type === "priority") return <Badge>{value}</Badge>;
  return value;
}

export function DataTable({ rows, columns, basePath, primaryKey }: { rows: PlainRow[]; columns: ListColumn[]; basePath: string; primaryKey: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => String(row.status ?? "")).filter(Boolean))).sort(), [rows]);
  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !lower || JSON.stringify(row).toLowerCase().includes(lower);
      const matchesStatus = !status || row.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, rows, status]);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-stone-200 bg-stone-50 p-4 md:flex-row md:items-center md:justify-between">
        <input aria-label="Search records" className="max-w-md" placeholder="Search records..." value={query} onChange={(event) => setQuery(event.target.value)} />
        {statuses.length > 0 ? (
          <select aria-label="Filter by status" className="max-w-xs" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-white text-left text-xs font-black uppercase tracking-wide text-stone-500">
            <tr>
              {columns.map((column) => <th className="px-4 py-3" key={column.key}>{column.label}</th>)}
              <th className="px-4 py-3">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {filtered.map((row) => (
              <tr className="hover:bg-amber-50/50" key={String(row.id)}>
                {columns.map((column, index) => (
                  <td className={`px-4 py-3 ${index === 0 ? "font-black text-stone-950" : "text-stone-700"}`} key={column.key}>{formatCell(row, column)}</td>
                ))}
                <td className="px-4 py-3"><Link className="font-black text-amber-700 hover:text-amber-900" href={`${basePath}/${String(row.id)}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-stone-200 bg-stone-50 px-4 py-3 text-xs font-semibold text-stone-500">Showing {filtered.length} of {rows.length} records. Primary: {primaryKey.replaceAll("_", " ")}.</div>
    </div>
  );
}
