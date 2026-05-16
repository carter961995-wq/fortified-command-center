import { ModuleNewPage } from "@/components/module-pages";

export default async function ResourceNewPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  return <ModuleNewPage slug={resource} />;
}
