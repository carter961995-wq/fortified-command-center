import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { formatCurrency, formatDate } from "@/lib/format";
import { LinkButton } from "@/components/link-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Maintenance contracts" };

export default async function MaintenanceContractsPage() {
  const { supabase } = await requireStaff();
  const { data: rows } = await supabase
    .from("maintenance_contracts")
    .select("id, contract_name, status, plan_type, recurring_amount, start_date, end_date, customers(company_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Maintenance contracts</h1>
          <p className="text-sm text-muted-foreground">Recurring inspections and service plans.</p>
        </div>
        <LinkButton href="/maintenance-contracts/new">New contract</LinkButton>
      </div>
      <Card>
        <CardContent className="px-0 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r) => {
                const c = unwrapEmbed<{ company_name: string }>(r.customers);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/maintenance-contracts/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.contract_name}
                      </Link>
                    </TableCell>
                    <TableCell>{c?.company_name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{String(r.plan_type).replaceAll("_", " ")}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(r.recurring_amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.start_date)} – {r.end_date ? formatDate(r.end_date) : "Open"}
                    </TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
