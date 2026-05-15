import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { getWorkOrder } from "../../actions";
import { getCustomers } from "@/app/(dashboard)/customers/actions";
import { getSubcontractors } from "@/app/(dashboard)/subcontractors/actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function EditWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let workOrder;
  try {
    workOrder = await getWorkOrder(id);
  } catch {
    notFound();
  }

  const [customers, subcontractors] = await Promise.all([
    getCustomers().catch(() => []),
    getSubcontractors().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Work Order"
        description={workOrder.title}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/work-orders/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />
      <WorkOrderForm
        workOrder={workOrder}
        customers={customers.map((c) => ({ id: c.id, company_name: c.company_name }))}
        subcontractors={subcontractors.map((s) => ({ id: s.id, company_name: s.company_name }))}
      />
    </div>
  );
}
