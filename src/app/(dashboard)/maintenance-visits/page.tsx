import { PageHeader } from "@/components/page-header";
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
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/constants";
import Link from "next/link";

export default async function MaintenanceVisitsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let visits: any[] = [];
  let error: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error: fetchError } = await supabase
      .from("maintenance_visits")
      .select("id, visit_date, completed, notes, contract:maintenance_contracts(id, title, customer:customers(company_name))")
      .order("visit_date", { ascending: false });
    if (fetchError) throw fetchError;
    visits = data ?? [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load visits";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance Visits" description="Track scheduled and completed visits" />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : visits.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No maintenance visits yet. Visits are created from maintenance contracts.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{formatDate(v.visit_date)}</TableCell>
                    <TableCell>
                      {v.contract ? (
                        <Link href={`/maintenance-contracts/${v.contract.id}`} className="text-blue-600 hover:underline">
                          {v.contract.title}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{v.contract?.customer?.company_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={v.completed ? "default" : "outline"}>
                        {v.completed ? "Completed" : "Scheduled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{v.notes ?? "—"}</TableCell>
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
