import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { HoleRouteBoundary } from "@/components/holes/hole-route-boundary";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function HoleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return (
    <HoleRouteBoundary key={holeId} holeId={holeId}>
      {children}
    </HoleRouteBoundary>
  );
}
