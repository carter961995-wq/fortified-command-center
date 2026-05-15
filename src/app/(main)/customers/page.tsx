import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const { supabase } = await requireStaff();

  let query = supabase.from("customers").select("*").order("company_name");
  if (q) query = query.ilike("company_name", `%${q}%`);
  if (status) query = query.eq("status", status);
  const { data: rows } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Commercial accounts and billing profiles.</p>
        </div>
        <LinkButton href="/customers/new">Add customer</LinkButton>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search & filter</CardTitle>
          <CardDescription>Filter by name or account status.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3">
            <Input name="q" placeholder="Company name…" defaultValue={q ?? ""} className="max-w-xs" />
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="prospect">Prospect</option>
            </select>
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
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No customers match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                (rows ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/customers/${c.id}`} className="text-primary hover:underline">
                        {c.company_name}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{String(c.customer_type).replaceAll("_", " ")}</TableCell>
                    <TableCell className="capitalize">{c.status}</TableCell>
                    <TableCell>
                      <div className="text-sm">{c.contact_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.contact_email ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <LinkButton href={`/customers/${c.id}`} size="sm" variant="outline">
                        View
                      </LinkButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
