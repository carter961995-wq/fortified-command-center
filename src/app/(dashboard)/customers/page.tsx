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
import { getCustomers } from "./actions";

export default async function CustomersPage() {
  let customers: Awaited<ReturnType<typeof getCustomers>> = [];
  let error: string | null = null;

  try {
    customers = await getCustomers();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load customers";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your commercial customers"
        actions={
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : customers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No customers yet. Add your first customer to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>City/State</TableHead>
                  <TableHead>Terms</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {c.company_name}
                      </Link>
                    </TableCell>
                    <TableCell>{c.contact_name}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>
                      {[c.billing_city, c.billing_state]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell>Net {c.payment_terms_days}</TableCell>
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
