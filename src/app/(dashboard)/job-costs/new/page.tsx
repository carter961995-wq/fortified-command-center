import { PageHeader } from "@/components/page-header";
import { JobCostForm } from "@/components/job-costs/job-cost-form";

export default async function NewJobCostPage({
  searchParams,
}: {
  searchParams: Promise<{ work_order_id?: string }>;
}) {
  const { work_order_id } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="Add Job Cost" description="Record a cost against a work order" />
      <JobCostForm defaultWorkOrderId={work_order_id} />
    </div>
  );
}
