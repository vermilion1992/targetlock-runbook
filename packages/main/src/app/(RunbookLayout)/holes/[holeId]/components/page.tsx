import { notFound } from "next/navigation";

import { HoleComponentSummary } from "@/components/components/hole-component-summary";
import { isRoutableHoleId } from "@/infrastructure/seed";

const NOTICES = [
  "bit-assigned",
  "reamer-assigned",
  "bit-changed",
  "reamer-changed",
] as const;

export default async function HoleComponentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ holeId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const [{ holeId }, query] = await Promise.all([params, searchParams]);
  if (!isRoutableHoleId(holeId)) notFound();
  const notice =
    typeof query.notice === "string" &&
    NOTICES.includes(query.notice as (typeof NOTICES)[number])
      ? (query.notice as (typeof NOTICES)[number])
      : undefined;
  return <HoleComponentSummary holeId={holeId} notice={notice} />;
}
