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
        description="mHelpDesk and TrueSource stay as inboxes. Connect them here, then run jobs in Job Intake."
      />
      <JobSourcesSetup googleMessage={sp.google} />
    </div>
  );
}
