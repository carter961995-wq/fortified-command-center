import { PageHeader } from "@/components/page-header";
import { MaintenanceContractForm } from "@/components/maintenance/contract-form";
import { getCustomers } from "@/app/(dashboard)/customers/actions";

export default async function NewMaintenanceContractPage() {
  const customers = await getCustomers().catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader title="New Maintenance Contract" description="Create a recurring maintenance contract" />
      <MaintenanceContractForm customers={customers.map((c) => ({ id: c.id, company_name: c.company_name }))} />
    </div>
  );
}
