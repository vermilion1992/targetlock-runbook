import { ComponentDetail } from "@/components/components/component-detail";

export default async function ComponentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ componentId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const [{ componentId }, query] = await Promise.all([params, searchParams]);
  return (
    <ComponentDetail
      componentId={componentId}
      notice={
        query.notice === "component-created" ? "component-created" : undefined
      }
    />
  );
}
