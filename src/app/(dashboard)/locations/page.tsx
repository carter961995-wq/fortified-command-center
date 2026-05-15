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
import { getLocations } from "./actions";

export default async function LocationsPage() {
  let locations: Awaited<ReturnType<typeof getLocations>> = [];
  let error: string | null = null;

  try {
    locations = await getLocations();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load locations";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        description="Manage job site locations"
        actions={
          <Button asChild>
            <Link href="/locations/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : locations.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No locations yet. Add your first location to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City/State</TableHead>
                  <TableHead>Site Contact</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell>
                      <Link
                        href={`/locations/${loc.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {loc.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {(loc.customer as { company_name: string })?.company_name ?? "—"}
                    </TableCell>
                    <TableCell>{loc.address_line1}</TableCell>
                    <TableCell>
                      {loc.city}, {loc.state}
                    </TableCell>
                    <TableCell>{loc.site_contact_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={loc.is_active ? "default" : "secondary"}>
                        {loc.is_active ? "Active" : "Inactive"}
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
