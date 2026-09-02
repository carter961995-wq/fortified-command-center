import { JobIntakePanel } from "../../../../components/job-intake-panel";

export const metadata = { title: "Job Intake" };

export default function JobIntakePage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Dispatch desk</p>
          <h1 className="mt-2 text-3xl font-black text-white">Job Intake</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-200">
            Parsed mHelpDesk, TrueSource, and Gmail jobs land here. Select a job, add notes, then accept it to the board.
          </p>
        </div>
      </header>
      <JobIntakePanel />
    </div>
  );
}
