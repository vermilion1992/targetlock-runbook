import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComponentDetail } from "@/components/components/component-registry";
import { DEFAULT_HOLE_ID } from "@/components/navigation/runbook-routes";
import { isRoutableHoleId } from "@/infrastructure/seed";

export const metadata: Metadata = {
  title: "Component Detail",
  description: "Review component identity, status, and assignment history.",
};

const componentIdPattern = /^component-[A-Za-z0-9._-]+$/;

export default async function ComponentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ componentId: string }>;
  searchParams: Promise<{ holeId?: string | string[] }>;
}) {
  const [{ componentId }, { holeId: requestedHoleId }] = await Promise.all([
    params,
    searchParams,
  ]);
  const holeId =
    typeof requestedHoleId === "string" ? requestedHoleId : DEFAULT_HOLE_ID;
  if (!componentIdPattern.test(componentId) || !isRoutableHoleId(holeId)) {
    notFound();
  }
  return <ComponentDetail componentId={componentId} holeId={holeId} />;
}
