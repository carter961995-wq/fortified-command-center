import Link from "next/link";
import { statusTone } from "@/lib/business";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Fortified Command Center</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="inline-flex items-center justify-center rounded-xl bg-amber-700 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-800" href={href}>
      {children}
    </Link>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return <button className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-black text-white hover:bg-amber-800" type="submit">{children}</button>;
}

export function SecondaryButton({ children }: { children: React.ReactNode }) {
  return <button className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-black text-stone-800 hover:bg-stone-50" type="submit">{children}</button>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  const tone = statusTone(String(children));
  const classes = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700"
  }[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${classes}`}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
      <h2 className="text-lg font-black text-stone-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-stone-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorNotice({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{message}</div>;
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <dt className="text-xs font-black uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-stone-950">{value || "-"}</dd>
    </div>
  );
}
