import { notFound } from "next/navigation";

import { InitialComponentAssignmentForm } from "@/components/components/initial-component-assignment-form";
import type { ComponentType } from "@/domain";
import { isRoutableHoleId } from "@/infrastructure/seed";

function toComponentType(value: string): ComponentType | null {
  const normalized = value.toLocaleUpperCase("en-AU");
  return normalized === "BIT" || normalized === "REAMER" ? normalized : null;
}

export default async function InitialComponentAssignmentPage({
  params,
}: {
  params: Promise<{ holeId: string; componentType: string }>;
}) {
  const { holeId, componentType: routeType } = await params;
  const componentType = toComponentType(routeType);
  if (!isRoutableHoleId(holeId) || componentType === null) {
    notFound();
  }
  return (
    <InitialComponentAssignmentForm
      holeId={holeId}
      componentType={componentType}
    />
  );
}
