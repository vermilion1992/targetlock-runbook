import { notFound } from "next/navigation";

import { SurveySettingsForm } from "@/components/trajectory/survey-settings-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function HoleSurveySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ holeId: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  const query = await searchParams;
  const raw = query.returnTo;
  const returnTo = Array.isArray(raw) ? raw[0] : raw;
  return <SurveySettingsForm holeId={holeId} returnTo={returnTo} />;
}
