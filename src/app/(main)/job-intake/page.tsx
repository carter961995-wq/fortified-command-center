import { JobIntakePanel } from "@/components/job-intake/job-intake-panel";

export const metadata = { title: "Job Intake" };

export default function JobIntakePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Intake</h1>
        <p className="text-sm text-muted-foreground">
          Pull mHelpDesk and TrueSource Affiliate Connect assignments into Fortified work-order format, then send them to subcontractors.
        </p>
      </div>
      <JobIntakePanel />
    </div>
  );
}
