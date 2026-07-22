import { notFound } from "next/navigation";

import { SurveyCorrectionForm } from "@/components/surveys/survey-correction-form";
import { targetLockStage4Seed } from "@/infrastructure/seed";

export default async function CorrectSurveyPage({
  params,
}: {
  params: Promise<{ holeId: string; surveyId: string }>;
}) {
  const { holeId, surveyId } = await params;
  if (holeId !== targetLockStage4Seed.hole.name) notFound();
  return <SurveyCorrectionForm holeId={holeId} surveyId={surveyId} />;
}
