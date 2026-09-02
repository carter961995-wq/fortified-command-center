"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppShell({
  profileName,
  profileEmail,
  demoMode = false,
  children,
}: {
  profileName: string;
  profileEmail: string;
  demoMode?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#0b1524] text-slate-50">
      <AppSidebar profileName={profileName} profileEmail={profileEmail} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-700 bg-[#07111f] px-4 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <button type="button" className="app-btn app-btn-secondary">
                  <Menu className="size-4" />
                  Menu
                </button>
              }
            />
            <SheetContent side="left" className="w-64 border-slate-700 bg-[#07111f] p-0 text-white">
              <div className="flex h-full flex-col" onClick={() => setOpen(false)}>
                <AppSidebar forceVisible profileName={profileName} profileEmail={profileEmail} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-black text-white">Command Center</span>
        </header>
        {demoMode ? (
          <div className="border-b border-orange-400/30 bg-orange-500/15 px-4 py-2 text-sm font-semibold text-orange-100">
            Demo mode with seeded jobs.{" "}
            <Link href="/job-sources" className="underline">
              Set up mHelpDesk or TrueSource
            </Link>{" "}
            when you want live intake.
          </div>
        ) : null}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
