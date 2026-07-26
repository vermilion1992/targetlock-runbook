"use client";

import { Camera, Images, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createBrowserRunbookServices,
  getCurrentHoleState,
} from "@/application/runbook";
import { MetricDisplay } from "@/components/field/metric-display";
import { StatusPill } from "@/components/field/status-pill";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { LocalMediaImage } from "@/components/media/local-media-image";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import {
  calculateTrayStatistics,
  decimetres,
  formatMetres,
  type Decimetres,
  type Photo,
  type Tray,
} from "@/domain";

function depthRange(tray: Tray): string {
  if (tray.startDepthDm === undefined || tray.endDepthDm === undefined) {
    return "Depth not recorded";
  }
  return `${formatMetres(tray.startDepthDm)}–${formatMetres(tray.endDepthDm)}`;
}

export function TrayLibrary({ holeId }: { holeId: string }) {
  const [trays, setTrays] = useState<readonly Tray[]>([]);
  const [photos, setPhotos] = useState<ReadonlyMap<string, Photo>>(new Map());
  const [replacementCount, setReplacementCount] = useState(0);
  const [currentDepth, setCurrentDepth] = useState<Decimetres | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() =>
        setError("Browser storage is unavailable."),
      );
      return;
    }
    void Promise.all([
      services.trays.listByHole(holeId),
      services.audits.listByHole(holeId),
      services.trays.recoverInterruptedOperations(holeId),
      getCurrentHoleState(holeId, services.currentState),
    ])
      .then(async ([records, audits, , state]) => {
        setTrays(records);
        setCurrentDepth(state.currentDepthDm);
        setReplacementCount(
          audits.filter(({ action }) => action === "tray_photograph_replaced")
            .length,
        );
        const photoRecords = await Promise.all(
          records.map(({ primaryPhotoId }) =>
            services.photos.getById(primaryPhotoId, holeId),
          ),
        );
        setPhotos(
          new Map(
            photoRecords.flatMap((photo) =>
              photo === null ? [] : [[photo.localId, photo] as const],
            ),
          ),
        );
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Tray library could not be loaded.",
        ),
      );
  }, [holeId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-AU");
    if (!query) return trays;
    return trays.filter(
      (tray) =>
        String(tray.trayNumber).includes(query) ||
        depthRange(tray).toLocaleLowerCase("en-AU").includes(query) ||
        tray.comment?.toLocaleLowerCase("en-AU").includes(query),
    );
  }, [search, trays]);
  const statistics = calculateTrayStatistics(trays, replacementCount);
  const deepestTrayEnd = trays.reduce(
    (deepest, tray) => Math.max(deepest, tray.endDepthDm ?? 0),
    0,
  );
  const uncoveredInterval =
    currentDepth === null
      ? null
      : decimetres(Math.max(0, Number(currentDepth) - deepestTrayEnd));

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 4 · completed trays"
        title={`${holeId} tray library`}
        description="Completed core-tray photographs stored locally and searchable by tray number or depth."
        action={
          <Link
            href={runbookRoutes.addTray(holeId)}
            className="tl-action-primary inline-flex min-h-11 items-center gap-2 rounded-[var(--tl-radius-sm)] px-4 font-bold text-white no-underline"
          >
            <Camera aria-hidden="true" className="size-5" />
            Photograph tray
          </Link>
        }
      />
      {error ? <p role="alert">{error}</p> : null}
      <section aria-label="Tray statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricDisplay label="Total trays" value={statistics.totalTrays} />
        <MetricDisplay label="Latest tray" value={statistics.latestTrayNumber ?? "—"} emphasis="strong" />
        <MetricDisplay
          label="Core awaiting tray"
          value={uncoveredInterval === null ? "—" : formatMetres(uncoveredInterval)}
        />
        <MetricDisplay
          label="Duplicate tray numbers"
          value={statistics.duplicateNumberConflicts}
        />
      </section>
      <label className="block max-w-xl">
        <span className="text-sm font-bold">Search tray number or depth</span>
        <span className="relative mt-2 block">
          <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-[var(--tl-ink-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] pl-10 pr-3"
          />
        </span>
      </label>
      <section aria-labelledby="tray-gallery-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="tray-gallery-heading" className="text-lg font-bold">
            Completed trays
          </h2>
          <StatusPill tone="info">
            <Images aria-hidden="true" className="size-4" />
            {filtered.length}
          </StatusPill>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((tray) => (
            <Link
              key={tray.localId}
              href={runbookRoutes.trayDetail(holeId, tray.localId)}
              aria-label={`Tray ${tray.trayNumber}, ${depthRange(tray)}`}
              className="overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] no-underline shadow-[var(--tl-shadow-sm)]"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <LocalMediaImage
                  photo={photos.get(tray.primaryPhotoId)}
                  alt={`Completed core tray ${tray.trayNumber}, ${depthRange(tray)}`}
                />
              </div>
              <div className="p-3">
                <h3 className="font-bold text-[var(--tl-ink)]">
                  TRAY {tray.trayNumber}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--tl-ink-muted)] sm:text-sm">
                  {depthRange(tray)}
                </p>
              </div>
            </Link>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="rounded-[var(--tl-radius-md)] border border-dashed border-[var(--tl-border-strong)] p-6 text-center text-[var(--tl-ink-muted)]">
            No trays match this search.
          </p>
        ) : null}
      </section>
      <LocalPrototypeNotice />
    </div>
  );
}
