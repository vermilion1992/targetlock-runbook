"use client";

import { Layers3, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  advanceCasing,
  createBrowserRunbookServices,
  getCasingHistory,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetreInput } from "@/components/field/metre-input";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  addDecimetres,
  decimetres,
  decimetresToMetres,
  formatMetres,
  parseMetreInput,
  validateCasingRange,
  type Decimetres,
} from "@/domain";

import {
  CasingNotice,
  CasingStatusPill,
  completedHoleDepth,
  createCasingId,
  defaultCasingActor,
  formatCasingDepth,
  formatCasingLength,
  type CasingHistoryRecord,
} from "./casing-support";

function bumpMetres(current: string, metres: 3 | 6): string {
  const parsed = parseMetreInput(current);
  const baseDm = parsed.ok ? parsed.value : decimetres(0);
  return decimetresToMetres(
    addDecimetres(baseDm, decimetres(metres * 10)),
  ).toFixed(1);
}

export function CasingHistory({ holeId }: { holeId: string }) {
  const [records, setRecords] = useState<readonly CasingHistoryRecord[]>([]);
  const [holeDepth, setHoleDepth] = useState<Decimetres | null>(null);
  const [newDepth, setNewDepth] = useState("");
  const [depthError, setDepthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError(
        "Browser storage is unavailable. Casing cannot be loaded.",
      );
      setLoading(false);
      return;
    }
    const depth = completedHoleDepth(holeId, services);
    const history = await getCasingHistory(holeId, services);
    setHoleDepth(depth);
    setRecords(history);
    const active = history.find(({ casing }) => casing.status === "ACTIVE");
    if (active) {
      setNewDepth(
        decimetresToMetres(active.casing.currentEndDepthDm).toFixed(1),
      );
    } else {
      setNewDepth("");
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        await reload();
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Casing could not be loaded.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per hole
  }, [holeId]);

  const activeRecord = records.find(({ casing }) => casing.status === "ACTIVE");
  const otherRecords = records.filter(
    ({ casing }) => casing.localId !== activeRecord?.casing.localId,
  );
  const parsedDepth = parseMetreInput(newDepth);
  const changeDm =
    activeRecord &&
    parsedDepth.ok &&
    parsedDepth.value > activeRecord.casing.currentEndDepthDm
      ? Number(parsedDepth.value) - Number(activeRecord.casing.currentEndDepthDm)
      : null;

  async function saveAdvance() {
    setError(null);
    setNotice(null);
    setDepthError(null);
    if (!activeRecord || holeDepth === null) {
      setError("No active casing is available to advance.");
      return;
    }
    const parsed = parseMetreInput(newDepth);
    if (!parsed.ok) {
      setDepthError("Enter the new end depth to 0.1 m precision.");
      return;
    }
    if (parsed.value <= activeRecord.casing.currentEndDepthDm) {
      setDepthError("New end depth must be deeper than the current end.");
      return;
    }
    const validation = validateCasingRange(
      activeRecord.casing.startDepthDm,
      parsed.value,
      holeDepth,
    );
    if (!validation.ok) {
      setDepthError(validation.reason);
      return;
    }
    if (validation.requiresDepthConfirmation) {
      setDepthError(
        `New end is deeper than completed hole depth (${formatMetres(holeDepth)}). Use Advance on the detail page if you need to confirm that.`,
      );
      return;
    }

    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable. The advance was not saved.");
      return;
    }

    setSaving(true);
    try {
      const actor = defaultCasingActor();
      await advanceCasing(
        {
          operationId: createCasingId("advance-casing"),
          casingStringId: activeRecord.casing.localId,
          holeId,
          newEndDepthDm: parsed.value,
          currentHoleDepthDm: holeDepth,
          recordedByUserId: actor.userId,
          recordedByNameSnapshot: actor.userName,
          recordedAt: new Date().toISOString(),
          expectedVersion: activeRecord.casing.version,
        },
        services,
      );
      setNotice("Casing advanced.");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The advance was not saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Casing"
        title={`${holeId} casing`}
        description="Current casing size and depth. Advance with +3 m / +6 m or type a new end depth."
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
        action={
          <Link
            href={runbookRoutes.addCasing(holeId)}
            className="tl-action-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--tl-radius-sm)] px-4 font-bold text-white no-underline"
          >
            <Plus aria-hidden="true" className="size-5" />
            {activeRecord ? "Change size" : "Add casing"}
          </Link>
        }
      />

      {error ? <CasingNotice tone="error">{error}</CasingNotice> : null}
      {notice ? <CasingNotice tone="success">{notice}</CasingNotice> : null}

      {!loading && !activeRecord && !error ? (
        <section className="rounded-[var(--tl-radius-lg)] border border-dashed border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-8 text-center">
          <Layers3
            aria-hidden="true"
            className="mx-auto size-9 text-[var(--tl-ink-muted)]"
          />
          <h2 className="mt-3 text-lg font-bold text-[var(--tl-ink)]">
            No active casing
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

      {activeRecord ? (
        <>
          <SectionPanel
            title="Current casing"
            description={activeRecord.casing.label || undefined}
            action={<CasingStatusPill status={activeRecord.casing.status} />}
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricDisplay
                label="Size"
                value={activeRecord.casing.casingSize}
                emphasis="strong"
              />
              <MetricDisplay
                label="Current end"
                value={formatCasingDepth(activeRecord.casing.currentEndDepthDm)}
                emphasis="strong"
              />
              <MetricDisplay
                label="Length"
                value={formatCasingLength(
                  activeRecord.casing.startDepthDm,
                  activeRecord.casing.currentEndDepthDm,
                )}
              />
              <MetricDisplay
                label="Hole depth"
                value={
                  holeDepth === null ? "—" : formatCasingDepth(holeDepth)
                }
              />
            </div>
          </SectionPanel>

          <SectionPanel title="Advance casing">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricDisplay
                  label="Previous end"
                  value={formatCasingDepth(
                    activeRecord.casing.currentEndDepthDm,
                  )}
                />
                <MetricDisplay
                  label="New end"
                  value={
                    parsedDepth.ok ? formatMetres(parsedDepth.value) : "—"
                  }
                  emphasis="strong"
                />
                <MetricDisplay
                  label="Change"
                  value={
                    changeDm === null
                      ? "—"
                      : `+${(changeDm / 10).toFixed(1)} m`
                  }
                />
              </div>

              <MetreInput
                label="New end depth"
                value={newDepth}
                onValueChange={(value) => {
                  setNewDepth(value);
                  setDepthError(null);
                  setNotice(null);
                }}
                min={0}
                required
                error={depthError ?? undefined}
                disabled={loading || saving}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading || saving}
                  onClick={() => {
                    setNewDepth(bumpMetres(newDepth, 3));
                    setDepthError(null);
                  }}
                  className="inline-flex min-h-12 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-4 font-bold disabled:opacity-60"
                >
                  +3 m
                </button>
                <button
                  type="button"
                  disabled={loading || saving}
                  onClick={() => {
                    setNewDepth(bumpMetres(newDepth, 6));
                    setDepthError(null);
                  }}
                  className="inline-flex min-h-12 items-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-4 font-bold disabled:opacity-60"
                >
                  +6 m
                </button>
              </div>

              <FieldActionButton
                type="button"
                disabled={loading || saving}
                busy={saving}
                onClick={() => void saveAdvance()}
                fullWidth
              >
                <Save aria-hidden="true" className="size-5" />
                {saving ? "Saving…" : "Save advance"}
              </FieldActionButton>
            </div>
          </SectionPanel>
        </>
      ) : null}

      {otherRecords.length > 0 ? (
        <SectionPanel title="Other strings">
          <ul className="space-y-3">
            {otherRecords.map(({ casing }) => (
              <li
                key={casing.localId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] px-4 py-3"
              >
                <div>
                  <p className="font-bold text-[var(--tl-ink)]">
                    {casing.casingSize}
                    {casing.label ? ` · ${casing.label}` : ""}
                  </p>
                  <p className="text-sm text-[var(--tl-ink-muted)]">
                    {formatCasingDepth(casing.startDepthDm)}–
                    {formatCasingDepth(casing.currentEndDepthDm)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <CasingStatusPill status={casing.status} />
                  <Link
                    href={runbookRoutes.casingDetail(holeId, casing.localId)}
                    className="font-bold text-[var(--tl-primary)] no-underline"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </SectionPanel>
      ) : null}

      {activeRecord ? (
        <p className="text-sm text-[var(--tl-ink-muted)]">
          <Link
            href={runbookRoutes.casingDetail(
              holeId,
              activeRecord.casing.localId,
            )}
            className="font-bold text-[var(--tl-primary)]"
          >
            Open casing detail
          </Link>{" "}
          for lifecycle changes.
        </p>
      ) : null}
    </div>
  );
}
