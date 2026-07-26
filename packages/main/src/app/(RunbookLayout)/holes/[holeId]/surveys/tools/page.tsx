import { notFound } from "next/navigation";

import { SurveyToolRegistry } from "@/components/surveys/survey-tool-registry";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function SurveyToolsPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <SurveyToolRegistry holeId={holeId} />;
}
