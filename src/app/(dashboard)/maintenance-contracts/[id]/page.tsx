import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getMaintenanceContract } from "../actions";
import { getCustomers } from "@/app/(dashboard)/customers/actions";
import { MaintenanceContractForm } from "@/components/maintenance/contract-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function EditMaintenanceContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let contract;
  try {
    contract = await getMaintenanceContract(id);
  } catch {
    notFound();
  }
  const customers = await getCustomers().catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Contract"
        description={contract.title}
        actions={
          <Button variant="outline" asChild>
            <Link href="/maintenance-contracts"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />
      <MaintenanceContractForm
        contract={contract}
        customers={customers.map((c) => ({ id: c.id, company_name: c.company_name }))}
      />
    </div>
  );
}
