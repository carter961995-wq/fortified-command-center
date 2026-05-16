import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardList,
  Users,
  HardHat,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  Receipt,
} from "lucide-react";

const stats = [
  { label: "Open Work Orders", value: "—", icon: ClipboardList, color: "text-blue-600" },
  { label: "Customers", value: "—", icon: Users, color: "text-emerald-600" },
  { label: "Active Subs", value: "—", icon: HardHat, color: "text-orange-600" },
  { label: "Revenue (MTD)", value: "—", icon: DollarSign, color: "text-green-600" },
  { label: "Urgent Orders", value: "—", icon: AlertTriangle, color: "text-red-600" },
  { label: "Pending Invoices", value: "—", icon: Clock, color: "text-amber-600" },
  { label: "Completed (MTD)", value: "—", icon: CheckCircle, color: "text-teal-600" },
  { label: "Outstanding AR", value: "—", icon: Receipt, color: "text-purple-600" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Fortified Work Order Command Center"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Work Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connect Supabase to see live data.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Due Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connect Supabase to see live data.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
