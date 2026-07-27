import type { Metadata } from "next";

import { ProjectOnboardingForm } from "@/components/projects/project-onboarding-form";

export const metadata: Metadata = {
  title: "Create Project",
  description: "Create a project and its initial operating rig.",
};

export default function NewProjectPage() {
  return <ProjectOnboardingForm />;
}
