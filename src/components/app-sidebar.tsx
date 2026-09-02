"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/auth";
import {
  Building2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plug,
  Settings,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Command Center", icon: LayoutDashboard },
  { href: "/job-intake", label: "Job Intake", icon: Inbox },
  { href: "/job-sources", label: "Job Sources", icon: Plug },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/subcontractors", label: "Subcontractors", icon: Users },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: FileSpreadsheet },
  { href: "/maintenance-contracts", label: "Maintenance", icon: Wrench },
  { href: "/reports", label: "Reports", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({
  profileName = "Admin",
  profileEmail = "",
  forceVisible = false,
}: {
  profileName?: string;
  profileEmail?: string;
  forceVisible?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "w-[240px] shrink-0 border-r border-slate-700 bg-[#07111f]",
        forceVisible ? "flex flex-col" : "hidden md:flex md:flex-col",
      )}
    >
      <div className="border-b border-slate-700 px-4 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">Fortified Fence & Weld</p>
        <p className="mt-1 text-base font-black text-white">Command Center</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-bold",
                active
                  ? "border-orange-400 bg-orange-500/15 text-orange-200"
                  : "border-transparent text-slate-200 hover:bg-slate-800 hover:text-white",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-700 p-3">
        <div className="mb-2 truncate px-1 text-xs text-slate-300">
          <div className="truncate font-bold text-white">{profileName}</div>
          <div className="truncate">{profileEmail}</div>
        </div>
        <form action={signOut}>
          <button type="submit" className="app-btn app-btn-secondary w-full justify-start">
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
