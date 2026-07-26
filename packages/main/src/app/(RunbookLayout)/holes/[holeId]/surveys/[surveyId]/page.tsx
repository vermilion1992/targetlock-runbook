import { notFound } from "next/navigation";

import { SurveyDetail } from "@/components/surveys/survey-detail";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ holeId: string; surveyId: string }>;
}) {
  const { holeId, surveyId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <SurveyDetail holeId={holeId} surveyId={surveyId} />;
}
