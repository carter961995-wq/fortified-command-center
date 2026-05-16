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
import { getJobCosts } from "./actions";
import { formatCurrency, formatDate } from "@/lib/constants";

export default async function JobCostsPage() {
  let costs: Awaited<ReturnType<typeof getJobCosts>> = [];
  let error: string | null = null;

  try {
    costs = await getJobCosts();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load job costs";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Costs"
        description="Track costs across all work orders"
        actions={
          <Button asChild>
            <Link href="/job-costs/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Cost
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : costs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No job costs recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.map((jc) => (
                  <TableRow key={jc.id}>
                    <TableCell>
                      <Link
                        href={`/work-orders/${jc.work_order_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {(jc.work_order as { title: string })?.title ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="outline">{jc.category}</Badge></TableCell>
                    <TableCell>{jc.description}</TableCell>
                    <TableCell>{jc.vendor_name ?? "—"}</TableCell>
                    <TableCell>{formatDate(jc.date)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(jc.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
