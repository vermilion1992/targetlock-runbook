import type { Metadata } from "next";

import { ProjectLibrary } from "@/components/projects/project-library";

export const metadata: Metadata = {
  title: "Project Holes",
  description: "Project hole register and operational status.",
};

export default async function ProjectHolesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectLibrary projectId={projectId} />;
}
