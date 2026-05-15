import { PageHeader } from "@/components/page-header";
import { QuoteForm } from "@/components/quotes/quote-form";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ work_order_id?: string }>;
}) {
  const { work_order_id } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="New Quote" description="Create a quote from a work order" />
      <QuoteForm defaultWorkOrderId={work_order_id} />
    </div>
  );
}
