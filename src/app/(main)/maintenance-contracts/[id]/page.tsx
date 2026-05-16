import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { generateMaintenanceVisitsFromForm, linkVisitToWorkOrder } from "@/actions/maintenance";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Maintenance contract" };

export default async function MaintenanceContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: c } = await supabase
    .from("maintenance_contracts")
    .select("*, customers(id, company_name), locations(id, location_name)")
    .eq("id", id)
    .single();
  if (!c) notFound();
  const cust = unwrapEmbed<{ id: string; company_name: string }>(c.customers);
  const loc = unwrapEmbed<{ id: string; location_name: string }>(c.locations);

  const { data: visits } = await supabase
    .from("maintenance_visits")
    .select("*, work_orders(work_order_number)")
    .eq("maintenance_contract_id", id)
    .order("scheduled_date", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.contract_name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {c.status} · {String(c.plan_type).replaceAll("_", " ")} · Inspection: {c.inspection_frequency}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {cust ? (
              <Link href={`/customers/${cust.id}`} className="text-primary hover:underline">
                {cust.company_name}
              </Link>
            ) : null}
            {loc ? (
              <span>
                {" "}
                ·{" "}
                <Link href={`/locations/${loc.id}`} className="text-primary hover:underline">
                  {loc.location_name}
                </Link>
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={generateMaintenanceVisitsFromForm}>
            <input type="hidden" name="contract_id" value={id} />
            <Button type="submit" variant="secondary" size="sm">
              Generate visits
            </Button>
          </form>
          <LinkButton href="/maintenance-contracts" variant="outline" size="sm">
            Back
          </LinkButton>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled visits</CardTitle>
          <CardDescription>Visits are generated from inspection frequency; link a visit to a work order when dispatched.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>WO</TableHead>
                <TableHead>Link WO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(visits ?? []).map((v) => {
                const wo = v.work_orders as { work_order_number: string } | null;
                return (
                  <TableRow key={v.id}>
                    <TableCell>{formatDate(v.scheduled_date)}</TableCell>
                    <TableCell className="capitalize">{v.status}</TableCell>
                    <TableCell>
                      {v.work_order_id && wo ? (
                        <Link href={`/work-orders/${v.work_order_id}`} className="text-primary hover:underline">
                          {wo.work_order_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <form action={linkVisitToWorkOrder.bind(null, v.id)} className="flex gap-2">
                        <Input name="work_order_id" placeholder="Work order UUID" className="h-8 max-w-[240px] font-mono text-xs" />
                        <Button type="submit" size="sm" variant="outline">
                          Link
                        </Button>
                      </form>
                    </TableCell>
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
