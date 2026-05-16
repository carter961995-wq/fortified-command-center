import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { updateCustomer } from "@/actions/customers";
import { formatCurrency, formatDate } from "@/lib/format";
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
import { InvoiceStatusBadge, QuoteStatusBadge, WorkOrderStatusBadge } from "@/components/status-badges";

export const metadata = { title: "Customer" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const { data: c } = await supabase.from("customers").select("*").eq("id", id).single();
  if (!c) notFound();

  const [{ data: locations }, { data: workOrders }, { data: quotes }, { data: invoices }, { data: payments }, { data: contracts }] =
    await Promise.all([
      supabase.from("locations").select("*").eq("customer_id", id).order("location_name"),
      supabase
        .from("work_orders")
        .select("id, work_order_number, title, status, scheduled_date, locations(city, state)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("quotes").select("id, quote_number, status, total_amount, created_at").eq("customer_id", id),
      supabase.from("invoices").select("id, invoice_number, status, total_amount, balance_due, invoice_date").eq("customer_id", id),
      supabase.from("payments").select("id, amount, payment_date, payment_method, invoice_id").eq("customer_id", id),
      supabase.from("maintenance_contracts").select("id, contract_name, status, plan_type, recurring_amount").eq("customer_id", id),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.company_name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {String(c.customer_type).replaceAll("_", " ")} · {c.status}
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/customers" variant="outline">
            All customers
          </LinkButton>
          <LinkButton href={`/locations/new?customer_id=${c.id}`}>Add location</LinkButton>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="work_orders">Work orders</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Edit customer</CardTitle>
              <CardDescription>Update billing and contact information.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateCustomer.bind(null, c.id)} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="company_name">Company name *</Label>
                  <Input id="company_name" name="company_name" required defaultValue={c.company_name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact name</Label>
                  <Input id="contact_name" name="contact_name" defaultValue={c.contact_name ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact email</Label>
                  <Input id="contact_email" name="contact_email" defaultValue={c.contact_email ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Contact phone</Label>
                  <Input id="contact_phone" name="contact_phone" defaultValue={c.contact_phone ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_email">Billing email</Label>
                  <Input id="billing_email" name="billing_email" defaultValue={c.billing_email ?? ""} />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="billing_address">Billing address</Label>
                  <Textarea id="billing_address" name="billing_address" rows={2} defaultValue={c.billing_address ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment terms</Label>
                  <Input id="payment_terms" name="payment_terms" defaultValue={c.payment_terms ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_type">Customer type *</Label>
                  <select
                    id="customer_type"
                    name="customer_type"
                    required
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                    defaultValue={c.customer_type}
                  >
                    <option value="commercial">Commercial</option>
                    <option value="residential">Residential</option>
                    <option value="facilities_network">Facilities network</option>
                    <option value="property_manager">Property manager</option>
                    <option value="government">Government</option>
                    <option value="school">School</option>
                    <option value="retail">Retail</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <select
                    id="status"
                    name="status"
                    required
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                    defaultValue={c.status}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="prospect">Prospect</option>
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={3} defaultValue={c.notes ?? ""} />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit">Save changes</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle>Locations</CardTitle>
              <CardDescription>Sites and access information for this account.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>City / State</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(locations ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        <Link href={`/locations/${l.id}`} className="text-primary hover:underline">
                          {l.location_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {l.city}, {l.state}
                      </TableCell>
                      <TableCell>
                        <LinkButton href={`/locations/${l.id}`} size="sm" variant="outline">
                          View
                        </LinkButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work_orders">
          <Card>
            <CardContent className="px-0 pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WO</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(workOrders ?? []).map((w) => {
                    const loc = unwrapEmbed<{ city: string; state: string }>(w.locations);
                    return (
                      <TableRow key={w.id}>
                        <TableCell>
                          <Link href={`/work-orders/${w.id}`} className="font-medium text-primary hover:underline">
                            {w.work_order_number}
                          </Link>
                        </TableCell>
                        <TableCell>{w.title}</TableCell>
                        <TableCell>{loc ? `${loc.city}, ${loc.state}` : "—"}</TableCell>
                        <TableCell>
                          <WorkOrderStatusBadge status={w.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes">
          <Card>
            <CardContent className="px-0 pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(quotes ?? []).map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Link href={`/quotes/${q.id}`} className="font-medium text-primary hover:underline">
                          {q.quote_number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatCurrency(q.total_amount)}</TableCell>
                      <TableCell>
                        <QuoteStatusBadge status={q.status} />
                      </TableCell>
                      <TableCell>{formatDate(q.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="px-0 pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoices ?? []).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link href={`/invoices/${i.id}`} className="font-medium text-primary hover:underline">
                          {i.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatCurrency(i.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(i.balance_due)}</TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={i.status} />
                      </TableCell>
                      <TableCell>{formatDate(i.invoice_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="px-0 pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.payment_date)}</TableCell>
                      <TableCell>{formatCurrency(p.amount)}</TableCell>
                      <TableCell className="capitalize">{p.payment_method}</TableCell>
                      <TableCell>
                        <Link href={`/invoices/${p.invoice_id}`} className="text-primary hover:underline">
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardContent className="px-0 pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(contracts ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Link href={`/maintenance-contracts/${m.id}`} className="font-medium text-primary hover:underline">
                          {m.contract_name}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">{String(m.plan_type).replaceAll("_", " ")}</TableCell>
                      <TableCell>{formatCurrency(m.recurring_amount)}</TableCell>
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
