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
  Settings,
  Shield,
  Tags,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/job-intake", label: "Job Intake", icon: Inbox },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/pricing", label: "Pricing", icon: Tags },
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
  /** When true, sidebar is always visible (e.g. mobile drawer). */
  forceVisible?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "w-60 shrink-0 border-r border-sidebar-border bg-sidebar",
        forceVisible ? "flex flex-col" : "hidden lg:flex lg:flex-col"
      )}
    >
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-primary">
            Fortified Fence & Weld
          </span>
          <span className="text-sm font-semibold text-sidebar-foreground">Work Order Command</span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4 shrink-0 opacity-80" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 truncate px-1 text-xs text-sidebar-foreground/70">
          <div className="truncate font-medium text-sidebar-foreground">{profileName}</div>
          <div className="truncate">{profileEmail}</div>
        </div>
        <Separator className="mb-2 bg-sidebar-border" />
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
