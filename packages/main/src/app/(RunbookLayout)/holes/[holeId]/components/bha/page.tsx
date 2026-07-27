import { notFound } from "next/navigation";

import { UpdateBhaForm } from "@/components/components/update-bha-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function UpdateBhaPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <UpdateBhaForm holeId={holeId} />;
}
