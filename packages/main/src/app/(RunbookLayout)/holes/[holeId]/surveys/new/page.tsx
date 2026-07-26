import { notFound } from "next/navigation";

import { SurveyForm } from "@/components/surveys/survey-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function AddSurveyPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <SurveyForm holeId={holeId} />;
}
