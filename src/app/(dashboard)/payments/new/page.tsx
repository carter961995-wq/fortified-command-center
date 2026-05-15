import { PageHeader } from "@/components/page-header";
import { PaymentForm } from "@/components/payments/payment-form";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice_id?: string }>;
}) {
  const { invoice_id } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="Record Payment" description="Record a payment against an invoice" />
      <PaymentForm defaultInvoiceId={invoice_id} />
    </div>
  );
}
