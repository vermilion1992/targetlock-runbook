import { notFound } from "next/navigation";

import { HandoverForm } from "@/components/shifts/handover-form";
import {
  isRoutableHoleId,
  targetLockStage2Seed,
} from "@/infrastructure/seed";

export default async function HandoverPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return (
    <HandoverForm
      holeId={holeId}
      drillers={targetLockStage2Seed.users
        .filter((user) => user.role === "driller" && user.active)
        .map((user) => ({ id: user.localId, name: user.displayName }))}
    />
  );
}
