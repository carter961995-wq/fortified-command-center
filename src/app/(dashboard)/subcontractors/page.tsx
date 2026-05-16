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
import { Plus, CheckCircle, XCircle } from "lucide-react";
import { getSubcontractors } from "./actions";

function statusVariant(status: string) {
  switch (status) {
    case "Active": return "default" as const;
    case "Pending": return "outline" as const;
    case "Suspended": return "destructive" as const;
    default: return "secondary" as const;
  }
}

export default async function SubcontractorsPage() {
  let subs: Awaited<ReturnType<typeof getSubcontractors>> = [];
  let error: string | null = null;

  try {
    subs = await getSubcontractors();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load subcontractors";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subcontractors"
        description="Manage your subcontractor network"
        actions={
          <Button asChild>
            <Link href="/subcontractors/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Subcontractor
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : subs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No subcontractors yet. Add your first subcontractor to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Trades</TableHead>
                  <TableHead>W9/COI</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <Link
                        href={`/subcontractors/${sub.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {sub.company_name}
                      </Link>
                      {sub.is_preferred && (
                        <Badge variant="outline" className="ml-2 text-xs">Preferred</Badge>
                      )}
                    </TableCell>
                    <TableCell>{sub.owner_name}</TableCell>
                    <TableCell>{sub.phone}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(sub.trades as string[]).slice(0, 2).map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                        {(sub.trades as string[]).length > 2 && (
                          <Badge variant="secondary" className="text-xs">+{(sub.trades as string[]).length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {sub.w9_received ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-400" />}
                        {sub.coi_received ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-400" />}
                      </div>
                    </TableCell>
                    <TableCell>{sub.jobs_completed}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
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
