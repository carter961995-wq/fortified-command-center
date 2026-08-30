import { PageHeader } from "@/components/page-header";
import { SubcontractorCommandMap } from "@/components/subcontractors/command-map/subcontractor-command-map";

export const metadata = { title: "Subcontractor map" };

export default function SubcontractorMapPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Subcontractor map"
        description="Coverage and dispatch fit across the states Fortified currently works."
      />
      <SubcontractorCommandMap />
    </div>
  );
}
