import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { updateLocation } from "@/actions/locations";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkOrderStatusBadge } from "@/components/status-badges";

export const metadata = { title: "Location" };

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: l } = await supabase.from("locations").select("*, customers(id, company_name)").eq("id", id).single();
  if (!l) notFound();
  const cust = unwrapEmbed<{ id: string; company_name: string }>(l.customers);

  const [{ data: workOrders }, { data: contracts }] = await Promise.all([
    supabase
      .from("work_orders")
      .select("id, work_order_number, title, status, trade_type, scheduled_date")
      .eq("location_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("maintenance_contracts").select("id, contract_name, status, plan_type").eq("location_id", id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{l.location_name}</h1>
          <p className="text-sm text-muted-foreground">
            {cust ? (
              <Link href={`/customers/${cust.id}`} className="text-primary hover:underline">
                {cust.company_name}
              </Link>
            ) : (
              "—"
            )}
            {" · "}
            {l.city}, {l.state} {l.zip}
          </p>
        </div>
        <LinkButton href="/locations" variant="outline">
          All locations
        </LinkButton>
      </div>

      <Tabs defaultValue="site">
        <TabsList>
          <TabsTrigger value="site">Site info</TabsTrigger>
          <TabsTrigger value="work">Work orders</TabsTrigger>
          <TabsTrigger value="maint">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="site">
          <Card>
            <CardHeader>
              <CardTitle>Edit location</CardTitle>
              <CardDescription>Access and site contact information.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateLocation.bind(null, l.id)} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="customer_id" value={l.customer_id} />
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="location_name">Location name *</Label>
                  <Input id="location_name" name="location_name" required defaultValue={l.location_name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store_number">Store #</Label>
                  <Input id="store_number" name="store_number" defaultValue={l.store_number ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gate_code">Gate code</Label>
                  <Input id="gate_code" name="gate_code" defaultValue={l.gate_code ?? ""} />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="address_line_1">Address line 1 *</Label>
                  <Input id="address_line_1" name="address_line_1" required defaultValue={l.address_line_1} />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="address_line_2">Address line 2</Label>
                  <Input id="address_line_2" name="address_line_2" defaultValue={l.address_line_2 ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" name="city" required defaultValue={l.city} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input id="state" name="state" required maxLength={2} className="uppercase" defaultValue={l.state} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input id="zip" name="zip" defaultValue={l.zip ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site_contact_name">Site contact</Label>
                  <Input id="site_contact_name" name="site_contact_name" defaultValue={l.site_contact_name ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site_contact_phone">Site phone</Label>
                  <Input id="site_contact_phone" name="site_contact_phone" defaultValue={l.site_contact_phone ?? ""} />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="site_contact_email">Site email</Label>
                  <Input id="site_contact_email" name="site_contact_email" defaultValue={l.site_contact_email ?? ""} />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="access_instructions">Access instructions</Label>
                  <Textarea
                    id="access_instructions"
                    name="access_instructions"
                    rows={4}
                    defaultValue={l.access_instructions ?? ""}
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={2} defaultValue={l.notes ?? ""} />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit">Save changes</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work">
          <Card>
            <CardContent className="px-0 pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WO</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(workOrders ?? []).map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Link href={`/work-orders/${w.id}`} className="font-medium text-primary hover:underline">
                          {w.work_order_number}
                        </Link>
                      </TableCell>
                      <TableCell>{w.title}</TableCell>
                      <TableCell className="capitalize">{String(w.trade_type).replaceAll("_", " ")}</TableCell>
                      <TableCell>
                        <WorkOrderStatusBadge status={w.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maint">
          <Card>
            <CardContent className="px-0 pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(contracts ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Link href={`/maintenance-contracts/${m.id}`} className="text-primary hover:underline">
                          {m.contract_name}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">{String(m.plan_type).replaceAll("_", " ")}</TableCell>
                      <TableCell className="capitalize">{m.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
