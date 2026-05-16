import { PageHeader } from "@/components/page-header";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { getCustomers } from "@/app/(dashboard)/customers/actions";
import { getSubcontractors } from "@/app/(dashboard)/subcontractors/actions";

export default async function NewWorkOrderPage() {
  const [customers, subcontractors] = await Promise.all([
    getCustomers().catch(() => []),
    getSubcontractors().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="New Work Order" description="Create a new work order" />
      <WorkOrderForm
        customers={customers.map((c) => ({ id: c.id, company_name: c.company_name }))}
        subcontractors={subcontractors.map((s) => ({ id: s.id, company_name: s.company_name }))}
      />
    </div>
  );
}
