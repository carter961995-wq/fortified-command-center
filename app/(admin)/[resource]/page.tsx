import { FeaturePage } from "../../../components/feature-pages";
import { ModuleListPage } from "../../../components/module-pages";
import { featurePageMap } from "../../../lib/schema";

export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (featurePageMap[resource] || resource === "invoices") {
    return <FeaturePage slug={resource} />;
  }
  return <ModuleListPage slug={resource} />;
}
