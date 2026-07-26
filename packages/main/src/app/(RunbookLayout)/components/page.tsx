import { notFound, redirect } from "next/navigation";

import {
  DEFAULT_HOLE_ID,
  runbookRoutes,
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
  redirect(runbookRoutes.holeComponents(holeId));
}
