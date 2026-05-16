import { PageHeader } from "@/components/page-header";
import { SubcontractorForm } from "@/components/subcontractors/subcontractor-form";

export default function NewSubcontractorPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New Subcontractor" description="Add a new subcontractor" />
      <SubcontractorForm />
    </div>
  );
}
