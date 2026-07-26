import { notFound, redirect } from "next/navigation";

import { isRoutableHoleId } from "@/infrastructure/seed";

interface RunsPageProps {
  params: Promise<{ holeId: string }>;
}

export default async function RunsPage({ params }: RunsPageProps) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) {
    notFound();
  }

  redirect(`/holes/${encodeURIComponent(holeId)}/runs/new`);
}
