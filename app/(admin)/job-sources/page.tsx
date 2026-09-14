import { PageHeader } from "../../../components/ui";
import { JobSourcesSetup } from "../../../components/job-sources-setup";

export default async function JobSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader
        title="Job sources"
        description="Log in once to Gmail, mHelpDesk, or Affiliate Connect. The Command Center pulls current work orders and keeps them organized from there."
      />
      <JobSourcesSetup googleMessage={sp.google} />
    </div>
  );
}
