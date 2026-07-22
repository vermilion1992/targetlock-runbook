import { notFound } from "next/navigation";

import { SurveyToolRegistry } from "@/components/surveys/survey-tool-registry";
import { targetLockStage4Seed } from "@/infrastructure/seed";

export default async function SurveyToolsPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (holeId !== targetLockStage4Seed.hole.name) notFound();
  return <SurveyToolRegistry holeId={holeId} />;
}
