import { PageHeader } from "@/components/page-header";
import { SubcontractorCommandMap } from "@/components/subcontractors/command-map/subcontractor-command-map";

export default function SubcontractorCommandMapPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Subcontractor Command Map"
        description="Map, manage, and source subcontractors across GA, LA, MS, AL, AR, KS, MO, and TN."
      />
      <SubcontractorCommandMap />
    </div>
  );
}
