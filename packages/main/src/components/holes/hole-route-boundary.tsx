"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { StatePanel } from "@/components/field/state-panel";
import { subscribeToExternalRunbookStorageChanges } from "@/infrastructure/drafts";
import { useOperatorSession } from "@/components/session";

type RouteState = "checking" | "available" | "missing" | "error";

export function HoleRouteBoundary({
  holeId,
  children,
}: {
  holeId: string;
  children: ReactNode;
}) {
  const { session, rememberHole } = useOperatorSession();
  const [state, setState] = useState<RouteState>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkHole() {
      const services = createBrowserRunbookServices();
      if (!services) {
        if (!cancelled) {
          setError("Browser storage is unavailable.");
          setState("error");
        }
        return;
      }
      try {
        const hole = await services.completion.getHole(holeId);
        if (!cancelled) {
          if (
            hole !== null &&
            session !== null &&
            session.lastHoleId !== hole.localId
          ) {
            rememberHole(hole.localId);
          }
          setState(hole === null ? "missing" : "available");
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The hole record could not be checked.",
          );
          setState("error");
        }
      }
    }

    void checkHole();
    const unsubscribe = subscribeToExternalRunbookStorageChanges(() => {
      void checkHole();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [holeId, rememberHole, session]);

  if (state === "available") {
    return children;
  }

  const projectLink = (
    <Link
      href="/projects"
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--tl-primary)] px-4 py-2 text-sm font-semibold text-white no-underline"
    >
      Open project library
    </Link>
  );

  if (state === "missing") {
    return (
      <StatePanel
        state="empty"
        title={`Hole ${holeId} was not found`}
        description="The URL is valid, but there is no matching local or assigned hole record."
        action={projectLink}
      />
    );
  }

  if (state === "error") {
    return (
      <StatePanel
        state="error"
        title="Hole could not be opened"
        description={error}
        action={projectLink}
      />
    );
  }

  return <StatePanel state="loading" title={`Opening hole ${holeId}`} />;
}
