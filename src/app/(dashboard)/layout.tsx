import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="container max-w-7xl mx-auto p-6">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
