import Link from "next/link";
import { signOutAction } from "../lib/actions";
import type { PlainRow } from "../lib/business";
import { navItems } from "../lib/schema";

export function AdminShell({ children, profile, envWarning }: { children: React.ReactNode; profile?: PlainRow | null; envWarning?: string }) {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-stone-800 bg-stone-950 text-white lg:block">
        <div className="border-b border-stone-800 p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-500">Fortified</p>
          <h1 className="mt-2 text-xl font-black leading-tight">Work Order Command Center</h1>
          <p className="mt-2 text-xs text-stone-400">Fence • Weld • Gates • Facilities</p>
        </div>
        <nav className="grid gap-1 p-4">
          {navItems.map((item) => (
            <Link key={item.href} className="rounded-xl px-3 py-2 text-sm font-bold text-stone-200 hover:bg-stone-800 hover:text-white" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-stone-800 p-4 text-xs text-stone-400">
          <p className="font-bold text-stone-200">{String(profile?.full_name ?? profile?.email ?? "Admin")}</p>
          <form action={signOutAction} className="mt-3">
            <button className="text-amber-400 hover:text-amber-300" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link className="font-black" href="/dashboard">Fortified CC</Link>
            <form action={signOutAction}><button className="text-sm font-bold text-amber-700">Sign out</button></form>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => <Link className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-bold" href={item.href} key={item.href}>{item.label}</Link>)}
          </div>
        </header>
        {envWarning ? <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm font-semibold text-amber-900">{envWarning}</div> : null}
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
