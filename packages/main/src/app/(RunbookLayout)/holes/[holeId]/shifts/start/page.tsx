import { notFound } from "next/navigation";

import { StartShiftForm } from "@/components/shifts/start-shift-form";
import {
  isRoutableHoleId,
  targetLockStage2Seed,
} from "@/infrastructure/seed";

export default async function StartShiftPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();

  return (
    <StartShiftForm
      holeId={holeId}
      drillers={targetLockStage2Seed.users
        .filter((user) => user.role === "driller" && user.active)
        .map((user) => ({ id: user.localId, name: user.displayName }))}
    />
  );
}
