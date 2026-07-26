import { notFound } from "next/navigation";

import { CasingInstallForm } from "@/components/casing/casing-install-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function AddCasingPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <CasingInstallForm holeId={holeId} />;
}
