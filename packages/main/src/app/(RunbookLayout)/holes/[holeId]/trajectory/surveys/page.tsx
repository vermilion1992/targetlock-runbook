import { notFound } from "next/navigation";

import { TrajectorySurveySelection } from "@/components/trajectory/trajectory-survey-selection";
import { isStage5HoleId } from "@/infrastructure/seed";

export default async function HoleTrajectorySurveysPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isStage5HoleId(holeId)) notFound();
  return <TrajectorySurveySelection holeId={holeId} />;
}
