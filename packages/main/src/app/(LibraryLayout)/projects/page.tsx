import type { Metadata } from "next";

import { ProjectLibrary } from "@/components/projects/project-library";

export const metadata: Metadata = {
  title: "Project Library",
  description: "Projects and their hole registers.",
};

export default function ProjectsPage() {
  return <ProjectLibrary />;
}
