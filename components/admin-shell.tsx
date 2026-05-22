import Link from "next/link";
import { Hammer } from "lucide-react";
import { signOutAction } from "../lib/actions";
import type { PlainRow } from "../lib/business";
import { SidebarNav } from "./sidebar-nav";

export function AdminShell({ children, profile, envWarning }: { children: React.ReactNode; profile?: PlainRow | null; envWarning?: string }) {
  return (
    <div className="min-h-screen bg-[#081326] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-[230px] border-r border-[#1c2b45] bg-[#060d1d] text-white shadow-2xl lg:block">
        <div className="border-b border-[#17243c] p-4">
          <Link href="/dashboard" className="block overflow-hidden rounded-lg border border-[#1e3152] bg-[#101d34] shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
            <div className="relative h-24 bg-[radial-gradient(circle_at_30%_15%,rgba(251,146,60,0.45),transparent_28%),linear-gradient(135deg,#1a2d4f,#080f21_60%,#3a1f0d)] p-3">
              <div className="absolute inset-x-3 bottom-3 rounded-md border border-orange-500/40 bg-black/45 p-2 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-md bg-orange-500/20 text-orange-400">
                    <Hammer className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase leading-none tracking-[0.18em] text-orange-300">Fence</p>
                    <p className="text-sm font-black leading-none text-white">Builders Bible</p>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
        <SidebarNav />
        <div className="absolute bottom-0 left-0 right-0 border-t border-[#17243c] bg-[#060d1d] p-4 text-xs text-slate-500">
          <p className="font-bold text-slate-200">{String(profile?.full_name ?? profile?.email ?? "Boss")}</p>
          <form action={signOutAction} className="mt-3">
            <button className="text-orange-400 hover:text-orange-300" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="lg:pl-[230px]">
        <header className="sticky top-0 z-20 border-b border-[#1c2b45] bg-[#060d1d]/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link className="font-black text-orange-400" href="/dashboard">Fence Builders Bible</Link>
            <form action={signOutAction}><button className="text-sm font-bold text-orange-400">Sign out</button></form>
          </div>
          <SidebarNav mobile />
        </header>
        {envWarning ? <div className="border-b border-orange-500/20 bg-orange-500/10 px-6 py-3 text-sm font-semibold text-orange-200">{envWarning}</div> : null}
        <main className="min-h-screen bg-[#0b1629] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
