import { FeaturePage } from "../../../components/feature-pages";
import { ModuleListPage } from "../../../components/module-pages";
import { featurePageMap } from "../../../lib/schema";

export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{ google?: string }>;
}) {
  const { resource } = await params;
  const sp = await searchParams;
  if (featurePageMap[resource] || resource === "invoices") {
    return <FeaturePage slug={resource} googleMessage={sp.google} />;
  }
  return <ModuleListPage slug={resource} />;
}
