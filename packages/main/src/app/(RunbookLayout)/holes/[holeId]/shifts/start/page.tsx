import { notFound } from "next/navigation";

import { StartShiftForm } from "@/components/shifts/start-shift-form";
import { targetLockStage2Seed } from "@/infrastructure/seed";

export default async function StartShiftPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (holeId !== targetLockStage2Seed.hole.name) notFound();

  return (
    <StartShiftForm
      holeId={holeId}
      rigId={targetLockStage2Seed.rig.localId}
      drillers={targetLockStage2Seed.users
        .filter((user) => user.role === "driller" && user.active)
        .map((user) => ({ id: user.localId, name: user.displayName }))}
    />
  );
}
