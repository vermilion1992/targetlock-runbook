import { notFound } from "next/navigation";

import { SurveyForm } from "@/components/surveys/survey-form";
import { targetLockStage4Seed } from "@/infrastructure/seed";

export default async function AddSurveyPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (holeId !== targetLockStage4Seed.hole.name) notFound();
  return <SurveyForm holeId={holeId} />;
}
