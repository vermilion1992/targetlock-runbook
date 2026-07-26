import { notFound } from "next/navigation";

import { TrayForm } from "@/components/trays/tray-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function AddTrayPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <TrayForm holeId={holeId} />;
}
