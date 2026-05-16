import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
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

export const metadata = { title: "Subcontractors" };

export default async function SubcontractorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; trade?: string; status?: string; preferred?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  let q = supabase.from("subcontractors").select("*").order("company_name");
  if (sp.q) q = q.ilike("company_name", `%${sp.q}%`);
  if (sp.state) q = q.contains("service_states", [sp.state]);
  if (sp.trade) q = q.contains("trades", [sp.trade]);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.preferred === "1") q = q.eq("preferred_vendor", true);
  const { data: rows } = await q;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subcontractors</h1>
          <p className="text-sm text-muted-foreground">Field partners, compliance, and performance.</p>
        </div>
        <LinkButton href="/subcontractors/new">Add subcontractor</LinkButton>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3">
            <Input name="q" placeholder="Company…" defaultValue={sp.q ?? ""} className="max-w-xs" />
            <Input name="state" placeholder="Service state (e.g. LA)" maxLength={2} defaultValue={sp.state ?? ""} className="w-28 uppercase" />
            <Input name="trade" placeholder="Trade code" defaultValue={sp.trade ?? ""} className="w-36" />
            <select name="status" defaultValue={sp.status ?? ""} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="probation">Probation</option>
              <option value="blocked">Blocked</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="preferred" value="1" defaultChecked={sp.preferred === "1"} />
              Preferred only
            </label>
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
                <TableHead>State</TableHead>
                <TableHead>Preferred</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/subcontractors/${s.id}`} className="text-primary hover:underline">
                      {s.company_name}
                    </Link>
                  </TableCell>
                  <TableCell>{s.state}</TableCell>
                  <TableCell>{s.preferred_vendor ? "Yes" : "—"}</TableCell>
                  <TableCell className="capitalize">{s.status}</TableCell>
                  <TableCell>
                    <LinkButton href={`/subcontractors/${s.id}`} size="sm" variant="outline">
                      View
                    </LinkButton>
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
