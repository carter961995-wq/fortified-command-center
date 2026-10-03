import { FeaturePage } from "../../../components/feature-pages";
import { ModuleListPage } from "../../../components/module-pages";
import { featurePageMap } from "../../../lib/schema";

export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{ google?: string; page?: string; q?: string; status?: string }>;
}) {
  const { resource } = await params;
  const sp = await searchParams;
  if (featurePageMap[resource] || resource === "invoices") {
    return <FeaturePage slug={resource} googleMessage={sp.google} query={sp.q} />;
  }
  const page = Number(sp.page ?? "1");
  return <ModuleListPage slug={resource} page={Number.isFinite(page) ? page : 1} q={sp.q ?? ""} status={sp.status ?? ""} />;
}
