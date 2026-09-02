import Link from "next/link";
import { statusTone } from "../lib/business";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#1f304d] pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">Fence Builders Bible</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-200">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[#1f304d] bg-[#111f38] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] ${className}`}>{children}</section>;
}

export function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-orange-600" href={href}>
      {children}
    </Link>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return <button className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600" type="submit">{children}</button>;
}

export function SecondaryButton({ children }: { children: React.ReactNode }) {
  return <button className="rounded-lg border border-[#2b4168] bg-[#0c172b] px-4 py-2 text-sm font-black text-slate-200 hover:bg-[#14233d]" type="submit">{children}</button>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  const tone = statusTone(String(children));
  const classes = {
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
    amber: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    slate: "border-slate-500/30 bg-slate-500/10 text-slate-300"
  }[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${classes}`}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#2b4168] bg-[#0c172b] p-8 text-center">
      <h2 className="text-lg font-black text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorNotice({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">{message}</div>;
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#213657] bg-[#0c172b] p-3">
      <dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-100">{value || "-"}</dd>
    </div>
  );
}
