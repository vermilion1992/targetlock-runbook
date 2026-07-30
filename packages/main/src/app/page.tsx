"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useOperatorSession } from "@/components/session";

export default function TargetLockHomePage() {
  const router = useRouter();
  const { loading, session, error } = useOperatorSession();

  useEffect(() => {
    if (loading || error) return;
    router.replace(session === null ? "/sign-in" : "/start");
  }, [error, loading, router, session]);

  return (
    <main className="target-lock grid min-h-dvh place-items-center bg-[var(--tl-canvas)] p-5 text-[var(--tl-ink)]">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--tl-primary)]">
          TargetLock
        </p>
        <p role={error ? "alert" : "status"} className="mt-2 font-semibold">
          {error ?? "Opening your field workspace…"}
        </p>
      </div>
    </main>
  );
}
