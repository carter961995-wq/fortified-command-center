import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { LocationForm } from "@/components/locations/location-form";
import { getLocation } from "../actions";
import { getCustomers } from "@/app/(dashboard)/customers/actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let location;
  try {
    location = await getLocation(id);
  } catch {
    notFound();
  }

  const customers = await getCustomers().catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Location"
        description={location.name}
        actions={
          <Button variant="outline" asChild>
            <Link href="/locations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />
      <LocationForm
        location={location}
        customers={customers.map((c) => ({ id: c.id, company_name: c.company_name }))}
      />
    </div>
  );
}
