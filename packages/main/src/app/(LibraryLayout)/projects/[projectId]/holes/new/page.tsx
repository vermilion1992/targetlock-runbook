import type { Metadata } from "next";

import { NewHoleForm } from "@/components/holes/new-hole-form";

export const metadata: Metadata = {
  title: "New Hole",
  description: "Create a draft hole in a project.",
};

export default async function ProjectNewHolePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <NewHoleForm projectId={projectId} />;
}
