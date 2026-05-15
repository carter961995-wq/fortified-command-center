import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Locations" };

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; customer_id?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();

  let q = supabase
    .from("locations")
    .select("id, location_name, city, state, store_number, customers(company_name)")
    .order("state")
    .order("city");

  if (sp.q) q = q.ilike("location_name", `%${sp.q}%`);
  if (sp.state) q = q.eq("state", sp.state);
  if (sp.customer_id) q = q.eq("customer_id", sp.customer_id);

  const { data: rows } = await q;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">Job sites and access details by customer.</p>
        </div>
        <LinkButton href="/locations/new">Add location</LinkButton>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search</CardTitle>
          <CardDescription>Filter by site name, city, state, or customer.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3">
            <Input name="q" placeholder="Site or city…" defaultValue={sp.q ?? ""} className="max-w-xs" />
            <Input name="state" placeholder="ST" maxLength={2} defaultValue={sp.state ?? ""} className="w-20 uppercase" />
            <Input name="customer_id" placeholder="Customer UUID" defaultValue={sp.customer_id ?? ""} className="max-w-xs font-mono text-xs" />
            <Button type="submit" size="sm" variant="secondary">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>City / ST</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((l) => {
                const c = unwrapEmbed<{ company_name: string }>(l.customers);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      <Link href={`/locations/${l.id}`} className="text-primary hover:underline">
                        {l.location_name}
                      </Link>
                      {l.store_number ? (
                        <div className="text-xs text-muted-foreground">Store #{l.store_number}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{c?.company_name ?? "—"}</TableCell>
                    <TableCell>
                      {l.city}, {l.state}
                    </TableCell>
                    <TableCell>
                      <LinkButton href={`/locations/${l.id}`} size="sm" variant="outline">
                        View
                      </LinkButton>
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
