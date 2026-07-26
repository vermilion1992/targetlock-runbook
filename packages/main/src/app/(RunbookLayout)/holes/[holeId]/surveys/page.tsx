import { notFound } from "next/navigation";

import { SurveyHistory } from "@/components/surveys/survey-history";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function SurveysPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <SurveyHistory holeId={holeId} />;
}
