import { JobSourcesSetup } from "../../../../components/job-sources-setup";

export const metadata = { title: "Job sources" };

export default async function JobSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Connections</p>
        <h1 className="mt-2 text-3xl font-black text-white">Job sources</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-slate-200">
          mHelpDesk and TrueSource stay as inboxes. This app is where you pick a source, connect it, and run the job.
        </p>
      </header>
      <JobSourcesSetup googleMessage={sp.google} />
    </div>
  );
}
