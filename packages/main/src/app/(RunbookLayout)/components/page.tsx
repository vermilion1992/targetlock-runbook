import { notFound } from "next/navigation";

import { ComponentRegistry } from "@/components/components/component-registry";
import {
  DEFAULT_HOLE_ID,
} from "@/components/navigation/runbook-routes";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function ComponentsPage({
  searchParams,
}: {
  searchParams: Promise<{ holeId?: string | string[] }>;
}) {
  const { holeId: requestedHoleId } = await searchParams;
  const holeId =
    typeof requestedHoleId === "string" ? requestedHoleId : DEFAULT_HOLE_ID;
  if (!isRoutableHoleId(holeId)) notFound();
  return <ComponentRegistry holeId={holeId} />;
}
