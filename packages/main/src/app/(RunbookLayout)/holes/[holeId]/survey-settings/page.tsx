import { notFound } from "next/navigation";

import { SurveySettingsForm } from "@/components/trajectory/survey-settings-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function HoleSurveySettingsPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <SurveySettingsForm holeId={holeId} />;
}
