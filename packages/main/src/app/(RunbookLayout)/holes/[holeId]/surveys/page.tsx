import { notFound } from "next/navigation";

import { SurveyHistory } from "@/components/surveys/survey-history";
import { targetLockStage4Seed } from "@/infrastructure/seed";

export default async function SurveysPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (holeId !== targetLockStage4Seed.hole.name) notFound();
  return <SurveyHistory holeId={holeId} />;
}
