"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  FileText,
  Folder,
  Globe,
  Inbox,
  LayoutDashboard,
  Mail,
  Map,
  NotebookPen,
  ReceiptText,
  Ruler,
  Settings,
  Users,
} from "lucide-react";
import { navItems } from "../lib/schema";

const navIcons = {
  Dashboard: LayoutDashboard,
  Planner: CalendarDays,
  Leads: Inbox,
  "Job Intake": ClipboardList,
  "Email Inbox": Mail,
  Clients: Users,
  Jobs: BriefcaseBusiness,
  Invoicing: ReceiptText,
  "Measurement Tool": Ruler,
  "Subcontractor Map": Map,
  "Website Extractor": Globe,
  Documents: FileText,
  Notepad: NotebookPen,
  "Fence Bible": BookOpen,
  Reports: Folder,
  Settings,
};

export function SidebarNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {navItems.map((item) => (
          <Link
            className="shrink-0 rounded-full bg-[#13213a] px-3 py-1 text-xs font-bold text-slate-300"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <nav className="grid gap-1 overflow-y-auto px-3 py-4">
      {navItems.map((item) => {
        const Icon = navIcons[item.label as keyof typeof navIcons] ?? Folder;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-bold transition ${
              active
                ? "border-orange-500 bg-orange-500/10 text-orange-400"
                : "border-transparent text-slate-400 hover:bg-[#111c31] hover:text-white"
            }`}
            href={item.href}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
