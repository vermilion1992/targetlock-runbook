import { notFound } from "next/navigation";

import { ChangeComponentForm } from "@/components/components/change-component-form";
import type { ComponentType } from "@/domain";
import { targetLockStage3Seed } from "@/infrastructure/seed";

function toComponentType(value: string): ComponentType | null {
  const normalized = value.toLocaleUpperCase("en-AU");
  return normalized === "BIT" || normalized === "REAMER" ? normalized : null;
}

export default async function ChangeComponentPage({
  params,
}: {
  params: Promise<{ holeId: string; componentType: string }>;
}) {
  const { holeId, componentType: routeType } = await params;
  const componentType = toComponentType(routeType);
  if (holeId !== targetLockStage3Seed.hole.name || componentType === null) {
    notFound();
  }
  return <ChangeComponentForm holeId={holeId} componentType={componentType} />;
}
