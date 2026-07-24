"use client";

import { useCallback, useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import type { MiniTargetLockResult } from "@/domain";

import { TrajectoryCockpit } from "./trajectory-cockpit";

export function TrajectoryDashboard({ holeId }: { holeId: string }) {
  const [result, setResult] = useState<MiniTargetLockResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const services = createBrowserRunbookServices();
    if (!services) {
      void Promise.resolve().then(() => {
        if (active) {
          setMessage("Browser storage is unavailable.");
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }
    void Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    void services.miniTargetLock
      .getMiniTargetLock(holeId)
      .then((next) => {
        if (!active) return;
        setResult(next);
        setMessage(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load trajectory.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [holeId, reloadToken]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--tl-ink-muted)]" data-testid="trajectory-loading">
        Loading trajectory…
      </p>
    );
  }

  if (message) {
    return (
      <p role="alert" className="text-sm text-[var(--tl-danger)]">
        {message}
      </p>
    );
  }

  if (!result) {
    return (
      <p className="text-sm text-[var(--tl-ink-muted)]">
        Trajectory data is unavailable.
      </p>
    );
  }

  return (
    <div data-testid="trajectory-dashboard">
      <TrajectoryCockpit holeId={holeId} result={result} onReload={reload} />
    </div>
  );
}
