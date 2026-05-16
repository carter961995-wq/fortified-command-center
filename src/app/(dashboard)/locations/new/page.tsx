import { PageHeader } from "@/components/page-header";
import { LocationForm } from "@/components/locations/location-form";
import { getCustomers } from "@/app/(dashboard)/customers/actions";

export default async function NewLocationPage() {
  const customers = await getCustomers().catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader title="New Location" description="Add a new job site location" />
      <LocationForm customers={customers.map((c) => ({ id: c.id, company_name: c.company_name }))} />
    </div>
  );
}
