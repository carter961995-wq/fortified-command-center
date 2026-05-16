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
import { getMaintenanceContracts } from "./actions";
import { formatCurrency, formatDate } from "@/lib/constants";

export default async function MaintenanceContractsPage() {
  let contracts: Awaited<ReturnType<typeof getMaintenanceContracts>> = [];
  let error: string | null = null;

  try {
    contracts = await getMaintenanceContracts();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load contracts";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Contracts"
        description="Manage recurring maintenance contracts"
        actions={
          <Button asChild>
            <Link href="/maintenance-contracts/new">
              <Plus className="mr-2 h-4 w-4" />
              New Contract
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : contracts.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No maintenance contracts yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Next Visit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/maintenance-contracts/${c.id}`} className="font-medium text-blue-600 hover:underline">
                        {c.title}
                      </Link>
                    </TableCell>
                    <TableCell>{(c.customer as { company_name: string })?.company_name ?? "—"}</TableCell>
                    <TableCell>{(c.location as { name: string })?.name ?? "—"}</TableCell>
                    <TableCell>{c.frequency}</TableCell>
                    <TableCell>{formatCurrency(c.monthly_amount)}</TableCell>
                    <TableCell>{formatDate(c.next_visit_date)}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
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
