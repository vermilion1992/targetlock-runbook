"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { StatePanel } from "@/components/field/state-panel";
import { useOperatorSession } from "./operator-session-provider";

export function RequireSupervisorSession({
  children,
}: {
  children: ReactNode;
}) {
  const { runtimeMode, session } = useOperatorSession();

  if (session?.operator.role === "SUPERVISOR") {
    return children;
  }

  return (
    <StatePanel
      state="empty"
      title="Supervisor setup only"
      description={
        runtimeMode === "pilot"
          ? "Your server-assigned Driller role cannot set up projects or holes. Ask a supervisor or company administrator."
          : "This local operator is signed in as a Driller. Ask a supervisor to set up projects and holes, then choose the available work from Start."
      }
      action={
        <Link
          href="/start"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--tl-primary)] px-4 py-2 text-sm font-semibold text-white no-underline"
        >
          Return to Choose your work
        </Link>
      }
    />
  );
}
