import { notFound } from "next/navigation";

import { CasingDetail } from "@/components/casing/casing-detail";
import { targetLockStage3Seed } from "@/infrastructure/seed";

export default async function CasingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ holeId: string; casingId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const [{ holeId, casingId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (holeId !== targetLockStage3Seed.hole.name) notFound();
  return (
    <CasingDetail
      holeId={holeId}
      casingId={casingId}
      notice={Array.isArray(query.notice) ? query.notice[0] : query.notice}
    />
  );
}
