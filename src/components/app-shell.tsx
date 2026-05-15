"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppShell({
  profileName,
  profileEmail,
  children,
}: {
  profileName: string;
  profileEmail: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <AppSidebar profileName={profileName} profileEmail={profileEmail} />
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-card px-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="gap-2">
                  <Menu className="size-4" />
                  Menu
                </Button>
              }
            />
            <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <div className="flex h-full flex-col">
                <div className="border-b border-sidebar-border p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-primary">
                    Fortified Fence & Weld
                  </span>
                  <div className="text-sm font-semibold">Work Order Command</div>
                </div>
                <div className="flex-1 overflow-auto" onClick={() => setOpen(false)}>
                  <AppSidebar forceVisible profileName={profileName} profileEmail={profileEmail} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <span className="ml-3 text-sm font-semibold text-foreground">Command Center</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
