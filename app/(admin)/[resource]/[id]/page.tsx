import { ModuleDetailPage } from "@/components/module-pages";

export default async function ResourceDetailPage({ params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params;
  return <ModuleDetailPage slug={resource} id={id} />;
}
