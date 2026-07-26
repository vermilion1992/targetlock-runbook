import { notFound } from "next/navigation";

import { HoleCompletionReview } from "@/components/holes/hole-completion-review";
import { isRoutableHoleId } from "@/infrastructure/seed/stage5-hole-ids";

export default async function CompleteHolePage({
  params,
  searchParams,
}: {
  params: Promise<{ holeId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const [{ holeId }, query] = await Promise.all([params, searchParams]);
  if (!isRoutableHoleId(holeId)) notFound();
  return (
    <HoleCompletionReview
      holeId={holeId}
      notice={query.notice === "hole-reopened" ? "hole-reopened" : undefined}
    />
  );
}
