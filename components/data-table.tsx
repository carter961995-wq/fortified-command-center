import Link from "next/link";
import { displayValue, formatDate, money, percent, type PlainRow } from "../lib/business";
import type { ListColumn } from "../lib/schema";
import { Badge } from "./ui";

function formatCell(row: PlainRow, column: ListColumn) {
  const value = displayValue(row, column.key);
  if (column.type === "money") return money(value === "-" ? 0 : value);
  if (column.type === "date") return formatDate(value);
  if (column.type === "percent") return percent(value);
  if (column.type === "boolean") return value;
  if (column.type === "status" || column.type === "priority") return <Badge>{value}</Badge>;
  return value;
}

function pageHref(slug: string, page: number, q: string, status: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/${slug}?${query}` : `/${slug}`;
}

export function DataTable({
  rows,
  columns,
  basePath,
  primaryKey,
  slug,
  page,
  pageSize,
  total,
  q,
  status,
  statuses,
}: {
  rows: PlainRow[];
  columns: ListColumn[];
  basePath: string;
  primaryKey: string;
  slug: string;
  page: number;
  pageSize: number;
  total: number;
  q: string;
  status: string;
  statuses: readonly string[];
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, (page - 1) * pageSize + rows.length);
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-[#1f304d] bg-[#111f38] shadow-sm">
      <form method="get" action={`/${slug}`} className="flex flex-col gap-3 border-b border-[#1f304d] bg-[#0c172b] p-4 md:flex-row md:items-center">
        <input aria-label="Search records" name="q" className="min-w-0 max-w-md" placeholder="Search all records..." defaultValue={q} />
        {statuses.length > 0 ? (
          <select aria-label="Filter by status" name="status" className="min-w-0 max-w-xs" defaultValue={status}>
            <option value="">All statuses</option>
            {statuses.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        ) : null}
        <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-white" type="submit">Search</button>
      </form>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#1f304d] text-sm">
          <thead className="bg-[#111f38] text-left text-xs font-black uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => <th className="px-4 py-3" key={column.key}>{column.label}</th>)}
              <th className="px-4 py-3">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f304d] bg-[#111f38]">
            {rows.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-400" colSpan={columns.length + 1}>No records match this search.</td></tr>
            ) : rows.map((row) => (
              <tr className="hover:bg-orange-500/5" key={String(row.id)}>
                {columns.map((column, index) => (
                  <td className={`px-4 py-3 ${index === 0 ? "font-black text-white" : "text-slate-300"}`} key={column.key}>{formatCell(row, column)}</td>
                ))}
                <td className="px-4 py-3"><Link className="font-black text-orange-400 hover:text-orange-300" href={`${basePath}/${String(row.id)}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1f304d] bg-[#0c172b] px-4 py-3 text-xs font-semibold text-slate-500">
        <span>Showing {from}-{to} of {total} records. Sorted by newest. Primary: {primaryKey.replaceAll("_", " ")}.</span>
        <span className="flex gap-3">
          {page > 1 ? <Link className="font-black text-orange-400" href={pageHref(slug, page - 1, q, status)}>Previous</Link> : null}
          <span>Page {Math.min(page, pages)} of {pages}</span>
          {page < pages ? <Link className="font-black text-orange-400" href={pageHref(slug, page + 1, q, status)}>Next</Link> : null}
        </span>
      </div>
    </div>
  );
}
