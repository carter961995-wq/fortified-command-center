import { PageHeader } from "@/components/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ work_order_id?: string }>;
}) {
  const { work_order_id } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="New Invoice" description="Create an invoice from a work order" />
      <InvoiceForm defaultWorkOrderId={work_order_id} />
    </div>
  );
}
