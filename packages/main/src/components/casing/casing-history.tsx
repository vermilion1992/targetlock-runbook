"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";

import {
  advanceCasing,
  createBrowserRunbookServices,
  getCasingHistory,
  installCasing,
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
  completedHoleDepth,
  createCasingId,
  defaultCasingActor,
  formatCasingDepth,
  type CasingHistoryRecord,
} from "./casing-support";

const PILOT_CASING_SIZES = ["PQ", "HQ"] as const;
type PilotCasingSize = (typeof PILOT_CASING_SIZES)[number];

function bumpMetres(current: string, metres: 3 | 6): string {
  const parsed = parseMetreInput(current);
  const baseDm = parsed.ok ? parsed.value : decimetres(0);
  return decimetresToMetres(
    addDecimetres(baseDm, decimetres(metres * 10)),
  ).toFixed(1);
}

function normalizeSize(value: string): string {
  return value.trim().toLocaleUpperCase("en-AU");
}

function recordForSize(
  records: readonly CasingHistoryRecord[],
  size: PilotCasingSize,
): CasingHistoryRecord | undefined {
  return records.find(
    ({ casing }) =>
      normalizeSize(casing.casingSize) === size &&
      (casing.status === "ACTIVE" || casing.status === "COMPLETED"),
  );
}

function activeRecordForSize(
  records: readonly CasingHistoryRecord[],
  size: PilotCasingSize,
): CasingHistoryRecord | undefined {
  return records.find(
    ({ casing }) =>
      normalizeSize(casing.casingSize) === size && casing.status === "ACTIVE",
  );
}

function defaultSelectedSize(
  records: readonly CasingHistoryRecord[],
): PilotCasingSize {
  const active = records
    .filter(({ casing }) => casing.status === "ACTIVE")
    .slice()
    .sort(
      (left, right) =>
        Number(right.casing.currentEndDepthDm) -
        Number(left.casing.currentEndDepthDm),
    );
  for (const size of ["HQ", "PQ"] as const) {
    if (
      active.some(({ casing }) => normalizeSize(casing.casingSize) === size)
    ) {
      return size;
    }
  }
  return "PQ";
}

function depthSeedForSize(
  records: readonly CasingHistoryRecord[],
  size: PilotCasingSize,
): string {
  const record = activeRecordForSize(records, size) ?? recordForSize(records, size);
  if (record) {
    return decimetresToMetres(record.casing.currentEndDepthDm).toFixed(1);
  }
  return "";
}

export function CasingHistory({ holeId }: { holeId: string }) {
  const [records, setRecords] = useState<readonly CasingHistoryRecord[]>([]);
  const [holeDepth, setHoleDepth] = useState<Decimetres | null>(null);
  const [selectedSize, setSelectedSize] = useState<PilotCasingSize>("PQ");
  const [newDepth, setNewDepth] = useState("");
  const [depthError, setDepthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sizeInitialized, setSizeInitialized] = useState(false);

  async function reload(preferredSize?: PilotCasingSize) {
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable. Casing cannot be loaded.");
      setLoading(false);
      return;
    }
    const depth = completedHoleDepth(holeId, services);
    const history = await getCasingHistory(holeId, services);
    setHoleDepth(depth);
    setRecords(history);
    const nextSize = preferredSize ?? defaultSelectedSize(history);
    setSelectedSize(nextSize);
    setNewDepth(depthSeedForSize(history, nextSize));
    setSizeInitialized(true);
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

  const installedRows = PILOT_CASING_SIZES.map((size) => {
    const record =
      activeRecordForSize(records, size) ?? recordForSize(records, size);
    return record ? { size, record } : null;
  }).filter((row): row is { size: PilotCasingSize; record: CasingHistoryRecord } =>
    row !== null,
  );

  const selectedActive = activeRecordForSize(records, selectedSize);
  const selectedInstalled = Boolean(
    selectedActive ?? recordForSize(records, selectedSize),
  );

  function selectSize(size: PilotCasingSize) {
    setSelectedSize(size);
    setNewDepth(depthSeedForSize(records, size));
    setDepthError(null);
    setNotice(null);
    setError(null);
  }

  async function saveCasing() {
    setError(null);
    setNotice(null);
    setDepthError(null);

    if (holeDepth === null) {
      setError("Current hole depth is unavailable. Casing was not saved.");
      return;
    }

    const parsed = parseMetreInput(newDepth);
    if (!parsed.ok) {
      setDepthError("Enter the casing depth to 0.1 m precision.");
      return;
    }

    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable. Casing was not saved.");
      return;
    }

    const actor = defaultCasingActor();
    const now = new Date().toISOString();
    const active = activeRecordForSize(records, selectedSize);

    if (active) {
      if (parsed.value <= active.casing.currentEndDepthDm) {
        setDepthError("Casing depth must be deeper than the current end.");
        return;
      }
      const validation = validateCasingRange(
        active.casing.startDepthDm,
        parsed.value,
        holeDepth,
      );
      if (!validation.ok) {
        setDepthError(validation.reason);
        return;
      }
      if (validation.requiresDepthConfirmation) {
        setDepthError(
          `Casing depth is deeper than completed hole depth (${formatMetres(holeDepth)}).`,
        );
        return;
      }

      setSaving(true);
      try {
        await advanceCasing(
          {
            operationId: createCasingId("advance-casing"),
            casingStringId: active.casing.localId,
            holeId,
            newEndDepthDm: parsed.value,
            currentHoleDepthDm: holeDepth,
            recordedByUserId: actor.userId,
            recordedByNameSnapshot: actor.userName,
            recordedAt: now,
            expectedVersion: active.casing.version,
          },
          services,
        );
        setNotice(`${selectedSize} casing updated.`);
        await reload(selectedSize);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Casing was not saved.",
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    const existing = recordForSize(records, selectedSize);
    if (existing && existing.casing.status !== "ACTIVE") {
      setError(
        `${selectedSize} casing exists but is not active. Use casing detail to change status before adding depth.`,
      );
      return;
    }

    const startDepthDm = decimetres(0);
    const validation = validateCasingRange(
      startDepthDm,
      parsed.value,
      holeDepth,
    );
    if (!validation.ok) {
      setDepthError(validation.reason);
      return;
    }
    if (validation.requiresDepthConfirmation) {
      setDepthError(
        `Casing depth is deeper than completed hole depth (${formatMetres(holeDepth)}).`,
      );
      return;
    }

    setSaving(true);
    try {
      const casingId = createCasingId(
        `casing-${holeId.toLocaleLowerCase("en-AU")}-${selectedSize.toLocaleLowerCase("en-AU")}`,
      );
      await installCasing(
        {
          operationId: createCasingId("install-casing"),
          casingStringId: casingId,
          holeId,
          casingSize: selectedSize,
          startDepthDm,
          endDepthDm: parsed.value,
          currentHoleDepthDm: holeDepth,
          installedAt: now,
          recordedAt: now,
          recordedByUserId: actor.userId,
          recordedByNameSnapshot: actor.userName,
        },
        services,
      );
      setNotice(`${selectedSize} casing added.`);
      await reload(selectedSize);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Casing was not saved.",
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
        description="Add PQ or HQ casing to depth."
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
      />

      {error ? <CasingNotice tone="error">{error}</CasingNotice> : null}
      {notice ? <CasingNotice tone="success">{notice}</CasingNotice> : null}

      {!loading && installedRows.length > 0 ? (
        <SectionPanel title="Current casing">
          <div className="space-y-3">
            {installedRows.map(({ size, record }) => (
              <div
                key={record.casing.localId}
                className="grid grid-cols-2 gap-3"
              >
                <MetricDisplay label="Size" value={size} emphasis="strong" />
                <MetricDisplay
                  label="Casing depth"
                  value={formatCasingDepth(record.casing.currentEndDepthDm)}
                  emphasis="strong"
                />
              </div>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      <SectionPanel
        title="Add casing"
        description={
          selectedInstalled
            ? `Add depth to ${selectedSize}.`
            : `Install ${selectedSize} to the entered depth.`
        }
      >
        <div className="space-y-4">
          <div
            role="group"
            aria-label="Casing size"
            className="grid grid-cols-2 gap-2"
          >
            {PILOT_CASING_SIZES.map((size) => {
              const selected = sizeInitialized && selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={loading || saving}
                  aria-pressed={selected}
                  onClick={() => selectSize(size)}
                  className={
                    selected
                      ? "inline-flex min-h-12 items-center justify-center rounded-[var(--tl-radius-sm)] bg-[var(--tl-primary)] px-4 font-bold text-white disabled:opacity-60"
                      : "inline-flex min-h-12 items-center justify-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-4 font-bold disabled:opacity-60"
                  }
                >
                  {size}
                </button>
              );
            })}
          </div>

          <MetreInput
            label="Casing depth"
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

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => {
                setNewDepth(bumpMetres(newDepth, 3));
                setDepthError(null);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-4 font-bold disabled:opacity-60"
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
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-4 font-bold disabled:opacity-60"
            >
              +6 m
            </button>
          </div>

          <FieldActionButton
            type="button"
            disabled={loading || saving}
            busy={saving}
            onClick={() => void saveCasing()}
            fullWidth
          >
            <Save aria-hidden="true" className="size-5" />
            {saving ? "Saving…" : "Add casing"}
          </FieldActionButton>
        </div>
      </SectionPanel>
    </div>
  );
}
