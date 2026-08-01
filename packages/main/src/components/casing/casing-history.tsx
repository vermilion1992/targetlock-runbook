"use client";

import { Layers3, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getCasingHistory,
} from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import type { Decimetres } from "@/domain";

import {
  CasingEventHistory,
  type CasingHistoryRecord,
  CasingNotice,
  CasingStatusPill,
  completedHoleDepth,
  formatCasingDate,
  formatCasingDepth,
  formatCasingLength,
} from "./casing-support";

export function CasingHistory({ holeId }: { holeId: string }) {
  const [records, setRecords] = useState<readonly CasingHistoryRecord[]>([]);
  const [holeDepth, setHoleDepth] = useState<Decimetres | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      const services = createBrowserRunbookServices();
      if (services === null) {
        if (active) {
          setError(
            "Browser storage is unavailable. Casing history cannot be loaded.",
          );
          setLoading(false);
        }
        return;
      }

      try {
        const depth = completedHoleDepth(holeId, services);
        const history = await getCasingHistory(holeId, services);
        if (active) {
          setHoleDepth(depth);
          setRecords(history);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Casing history could not be loaded.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [holeId]);

  const activeStrings = records.filter(
    ({ casing }) => casing.status === "ACTIVE",
  ).length;
  const totalEvents = records.reduce(
    (total, { events }) => total + events.length,
    0,
  );
  const ordered = [...records].sort(
    (left, right) => {
      if (left.casing.startDepthDm !== right.casing.startDepthDm) {
        return left.casing.startDepthDm < right.casing.startDepthDm ? -1 : 1;
      }
      if (left.casing.currentEndDepthDm !== right.casing.currentEndDepthDm) {
        return left.casing.currentEndDepthDm < right.casing.currentEndDepthDm
          ? -1
          : 1;
      }
      return 0;
    },
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Casing"
        title="Casing history"
        description={`Current casing strings and their permanent event history for ${holeId}. Corrections add events; they never replace the original record.`}
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
        action={
          <Link
            href={runbookRoutes.addCasing(holeId)}
            className="tl-action-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--tl-radius-sm)] px-4 font-bold text-white no-underline"
          >
            <Plus aria-hidden="true" className="size-5" />
            Add casing
          </Link>
        }
      />

      {error ? <CasingNotice tone="error">{error}</CasingNotice> : null}

      <section aria-label="Casing summary" className="grid gap-3 sm:grid-cols-3">
        <MetricDisplay
          label="Completed hole depth"
          value={holeDepth === null ? "—" : formatCasingDepth(holeDepth)}
          supportingText="Deepest completed run"
          emphasis="strong"
        />
        <MetricDisplay
          label="Active strings"
          value={loading ? "—" : activeStrings}
          supportingText={`${records.length} total casing string${records.length === 1 ? "" : "s"}`}
        />
        <MetricDisplay
          label="Immutable events"
          value={loading ? "—" : totalEvents}
          supportingText="Includes visible corrections"
        />
      </section>

      <div role="status" aria-live="polite" className="sr-only">
        {loading
          ? "Loading casing history."
          : `Loaded ${records.length} casing strings and ${totalEvents} events.`}
      </div>

      {!loading && ordered.length === 0 && !error ? (
        <section className="rounded-[var(--tl-radius-lg)] border border-dashed border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-8 text-center">
          <Layers3
            aria-hidden="true"
            className="mx-auto size-9 text-[var(--tl-ink-muted)]"
          />
          <h2 className="mt-3 text-lg font-bold text-[var(--tl-ink)]">
            No casing has been recorded
          </h2>
          <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
            Add the first casing string for this hole.
          </p>
          <Link
            href={runbookRoutes.addCasing(holeId)}
            className="mt-5 inline-flex min-h-12 items-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-5 font-bold text-white no-underline"
          >
            Add casing
          </Link>
        </section>
      ) : null}

      <div className="space-y-4">
        {ordered.map(({ casing, events }, index) => (
          <SectionPanel
            key={casing.localId}
            title={casing.label || `${casing.casingSize} casing`}
            description={`${index === 0 ? "Outer string" : `Nested string ${index + 1}`} · installed ${formatCasingDate(casing.installedAt)}`}
            action={<CasingStatusPill status={casing.status} />}
            contentClassName="space-y-5"
            footer={
              <Link
                href={runbookRoutes.casingDetail(holeId, casing.localId)}
                className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
              >
                View casing detail
              </Link>
            }
          >
            <dl className="grid grid-cols-2 gap-3 rounded-[var(--tl-radius-md)] bg-[var(--tl-surface-sunken)] p-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                  Size
                </dt>
                <dd className="mt-1 text-lg font-bold text-[var(--tl-ink)]">
                  {casing.casingSize}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                  Start
                </dt>
                <dd className="mt-1 text-lg font-bold text-[var(--tl-ink)]">
                  {formatCasingDepth(casing.startDepthDm)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                  Current end
                </dt>
                <dd className="mt-1 text-lg font-bold text-[var(--tl-ink)]">
                  {formatCasingDepth(casing.currentEndDepthDm)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                  Length
                </dt>
                <dd className="mt-1 text-lg font-bold text-[var(--tl-ink)]">
                  {formatCasingLength(
                    casing.startDepthDm,
                    casing.currentEndDepthDm,
                  )}
                </dd>
              </div>
            </dl>
            <CasingEventHistory events={events} />
          </SectionPanel>
        ))}
      </div>
    </div>
  );
}
