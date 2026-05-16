import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SubcontractorForm } from "@/components/subcontractors/subcontractor-form";
import { getSubcontractor } from "../actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function EditSubcontractorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let sub;
  try {
    sub = await getSubcontractor(id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Subcontractor"
        description={sub.company_name}
        actions={
          <Button variant="outline" asChild>
            <Link href="/subcontractors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />
      <SubcontractorForm subcontractor={sub} />
    </div>
  );
}
