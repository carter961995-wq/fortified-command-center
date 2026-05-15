import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { getWorkOrders } from "./actions";
import { getStatusColor, getPriorityColor, formatDate, formatCurrency } from "@/lib/constants";
import type { WorkOrderStatus, Priority } from "@/lib/types/database";

export default async function WorkOrdersPage() {
  let orders: Awaited<ReturnType<typeof getWorkOrders>> = [];
  let error: string | null = null;

  try {
    orders = await getWorkOrders();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load work orders";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Orders"
        description="Manage all work orders"
        actions={
          <Button asChild>
            <Link href="/work-orders/new">
              <Plus className="mr-2 h-4 w-4" />
              New Work Order
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No work orders yet. Create your first work order to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>NTE</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell>
                        <Link
                          href={`/work-orders/${wo.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {wo.title}
                        </Link>
                        {wo.customer_wo_number && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            #{wo.customer_wo_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(wo.customer as { company_name: string })?.company_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        {(wo.location as { name: string; city: string; state: string })
                          ? `${(wo.location as { name: string }).name}`
                          : "—"}
                      </TableCell>
                      <TableCell>{wo.trade_type}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(wo.priority as Priority)}>
                          {wo.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(wo.status as WorkOrderStatus)}>
                          {wo.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {wo.nte_amount ? formatCurrency(wo.nte_amount) : "—"}
                      </TableCell>
                      <TableCell>{formatDate(wo.due_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
