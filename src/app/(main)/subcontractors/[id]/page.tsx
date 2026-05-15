import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { updateSubcontractor } from "@/actions/subcontractors";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkOrderStatusBadge } from "@/components/status-badges";

export const metadata = { title: "Subcontractor" };

export default async function SubcontractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: s } = await supabase.from("subcontractors").select("*").eq("id", id).single();
  if (!s) notFound();

  const { data: jobs } = await supabase
    .from("work_orders")
    .select("id, work_order_number, title, status")
    .eq("subcontractor_id", id)
    .order("created_at", { ascending: false });

  const { data: paidRows } = await supabase
    .from("job_costs")
    .select("amount")
    .eq("subcontractor_id", id)
    .eq("paid", true);
  const totalPaid = (paidRows ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s.company_name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {s.status} {s.preferred_vendor ? "· Preferred vendor" : ""}
          </p>
        </div>
        <LinkButton href="/subcontractors" variant="outline">
          Back
        </LinkButton>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Jobs completed</CardDescription>
            <CardTitle className="text-xl">{s.jobs_completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Callbacks</CardDescription>
            <CardTitle className="text-xl">{s.callback_count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Quality / response</CardDescription>
            <CardTitle className="text-xl">
              {s.quality_score ?? "—"} / {s.response_score ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total paid (job costs)</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCurrency(totalPaid)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
          <CardDescription>Insurance, tax, and certificate tracking.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>W-9: {s.w9_received ? "Received" : "Missing"}</div>
          <div>Agreement: {s.subcontractor_agreement_signed ? "Signed" : "Missing"}</div>
          <div>COI: {s.coi_received ? "Received" : "Missing"}</div>
          <div>Insurance exp: {s.insurance_expiration ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit subcontractor</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSubcontractor.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="company_name">Company *</Label>
              <Input id="company_name" name="company_name" required defaultValue={s.company_name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner</Label>
              <Input id="owner_name" name="owner_name" defaultValue={s.owner_name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={s.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" defaultValue={s.email ?? ""} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" defaultValue={s.address ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={s.city ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" maxLength={2} className="uppercase" defaultValue={s.state ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" name="zip" defaultValue={s.zip ?? ""} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="service_states">Service states (comma)</Label>
              <Input id="service_states" name="service_states" defaultValue={(s.service_states ?? []).join(", ")} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="trades">Trades (comma)</Label>
              <Input id="trades" name="trades" defaultValue={(s.trades ?? []).join(", ")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="standard_labor_rate">Std labor rate</Label>
              <Input id="standard_labor_rate" name="standard_labor_rate" type="number" step="0.01" defaultValue={s.standard_labor_rate ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency_labor_rate">Emergency rate</Label>
              <Input id="emergency_labor_rate" name="emergency_labor_rate" type="number" step="0.01" defaultValue={s.emergency_labor_rate ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip_charge">Trip charge</Label>
              <Input id="trip_charge" name="trip_charge" type="number" step="0.01" defaultValue={s.trip_charge ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <select id="status" name="status" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" defaultValue={s.status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="probation">Probation</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="w9_received" defaultChecked={s.w9_received} />
                W-9
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="subcontractor_agreement_signed" defaultChecked={s.subcontractor_agreement_signed} />
                Agreement
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="coi_received" defaultChecked={s.coi_received} />
                COI
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="preferred_vendor" defaultChecked={s.preferred_vendor} />
                Preferred
              </label>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={s.notes ?? ""} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned work orders</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(jobs ?? []).map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <Link href={`/work-orders/${w.id}`} className="text-primary hover:underline">
                      {w.work_order_number}
                    </Link>
                  </TableCell>
                  <TableCell>{w.title}</TableCell>
                  <TableCell>
                    <WorkOrderStatusBadge status={w.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
