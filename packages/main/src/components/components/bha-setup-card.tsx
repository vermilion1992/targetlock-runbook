"use client";

import { Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { BhaBarrelSetupDisplay } from "@/components/components/bha-barrel-setup-display";
import { cardActionPrimary } from "@/components/field/card-action-styles";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import type { BottomHoleAssemblySetup } from "@/infrastructure/components";

export function BhaSetupCard({ holeId }: { holeId: string }) {
  const [setup, setSetup] = useState<BottomHoleAssemblySetup | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const services = createBrowserRunbookServices();
      if (services === null) return;
      const current = await services.bhaSetups.getCurrent(holeId);
      if (!active) return;
      setSetup(current);
    };
    void load().catch(() => {
      if (active) {
        setMessage("Bottom-hole assembly settings could not be loaded.");
      }
    });
    return () => {
      active = false;
    };
  }, [holeId]);

  return (
    <section
      aria-labelledby="bha-setup-heading"
      className="space-y-5 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] md:p-5"
    >
      <div className="flex items-start gap-3">
        <Settings2
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--tl-primary)]"
        />
        <div>
          <h2 id="bha-setup-heading" className="text-lg font-bold">
            Active barrel setup
          </h2>
          <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
            Bit, front reamer, barrel, and rear reamer with full BHA size and
            constant stick-up. Edit everything on Update BHA.
          </p>
        </div>
      </div>

      {message ? (
        <p role="status" className="text-sm font-semibold">
          {message}
        </p>
      ) : (
        <BhaBarrelSetupDisplay setup={setup} />
      )}

      <Link href={runbookRoutes.updateBha(holeId)} className={cardActionPrimary}>
        Update BHA
      </Link>
    </section>
  );
}
