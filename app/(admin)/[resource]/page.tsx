import { ModuleListPage } from "@/components/module-pages";

export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  return <ModuleListPage slug={resource} />;
}
