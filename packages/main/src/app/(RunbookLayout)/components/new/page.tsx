import { notFound } from "next/navigation";

import { AddComponentForm } from "@/components/components/add-component-form";
import { resolveSafeReturnPath } from "@/components/navigation/resolve-safe-return-path";
import {
  DEFAULT_HOLE_ID,
  runbookRoutes,
} from "@/components/navigation/runbook-routes";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function NewComponentPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string | string[];
    holeId?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const { type, holeId: requestedHoleId, returnTo } = await searchParams;
  const holeId =
    typeof requestedHoleId === "string" ? requestedHoleId : DEFAULT_HOLE_ID;
  if (!isRoutableHoleId(holeId)) notFound();
  const parent = resolveSafeReturnPath({
    requestedReturnTo: typeof returnTo === "string" ? returnTo : undefined,
    canonicalFallback: runbookRoutes.holeComponents(holeId),
    currentHoleId: holeId,
  });
  return (
    <AddComponentForm
      initialType={type === "REAMER" ? "REAMER" : "BIT"}
      holeId={holeId}
      returnTo={parent.href}
    />
  );
}
