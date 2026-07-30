import type { Metadata } from "next";

import { resolveStartHoleDestination } from "@/components/navigation/resolve-sign-in-destination";
import { StartWorkspace } from "@/components/session";

export const metadata: Metadata = {
  title: "Start",
  description: "Choose and confirm the work context for this operator.",
};

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    access?: string | string[];
    device?: string | string[];
    error?: string | string[];
  }>;
}) {
  const { next, access, device, error } = await searchParams;
  const requestedDestination = resolveStartHoleDestination(next);
  const notice =
    access === "denied"
      ? "access-denied"
      : device === "required"
        ? "device-required"
        : error === "configuration"
          ? "configuration"
          : null;
  return (
    <StartWorkspace
      key={requestedDestination?.href ?? "default-start"}
      requestedDestination={requestedDestination}
      notice={notice}
    />
  );
}
