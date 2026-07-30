"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useOperatorSession } from "./operator-session-provider";

export function RequireOperatorSession({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, runtimeMode, session, error } = useOperatorSession();

  useEffect(() => {
    if (!loading && session === null && error === null) {
      const currentLocation =
        typeof window === "undefined"
          ? pathname
          : `${pathname}${window.location.search}${window.location.hash}`;
      const next =
        pathname && pathname !== "/" && pathname !== "/start"
          ? `?next=${encodeURIComponent(currentLocation)}`
          : "";
      router.replace(`/sign-in${next}`);
    }
  }, [error, loading, pathname, router, session]);

  if (error) {
    return (
      <main className="target-lock grid min-h-dvh place-items-center bg-[var(--tl-canvas)] p-5">
        <div
          role="alert"
          className="w-full max-w-md rounded-[var(--tl-radius-lg)] border border-[var(--tl-danger)] bg-[var(--tl-surface)] p-5 text-[var(--tl-ink)] shadow-[var(--tl-shadow-md)]"
        >
          <h1 className="text-xl font-bold">
            {runtimeMode === "pilot"
              ? "Secure pilot session unavailable"
              : "Local sign-in unavailable"}
          </h1>
          <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">{error}</p>
        </div>
      </main>
    );
  }

  if (loading || session === null) {
    return (
      <main
        className="target-lock grid min-h-dvh place-items-center bg-[var(--tl-canvas)] p-5 text-[var(--tl-ink)]"
        aria-busy="true"
      >
        <p role="status" className="font-semibold">
          Opening TargetLock…
        </p>
      </main>
    );
  }

  return children;
}
