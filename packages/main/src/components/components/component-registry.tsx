"use client";

import { ArrowRight, CirclePlus, Drill, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { SectionPanel } from "@/components/field/section-panel";
import { StatePanel } from "@/components/field/state-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import type { Component, ComponentAssignment } from "@/domain";
import type { ComponentCorrection } from "@/infrastructure/components";
import {
  ComponentStatusPill,
  formatComponentDate,
  formatComponentDepth,
  titleCase,
} from "./component-support";

const primaryActionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--tl-primary)] px-4 py-2 text-sm font-semibold text-white no-underline";

interface RegistryItem {
  readonly component: Component;
  readonly assignments: readonly ComponentAssignment[];
}

interface ComponentDetailData {
  readonly component: Component;
  readonly assignments: readonly ComponentAssignment[];
  readonly corrections: readonly ComponentCorrection[];
}

function componentDescription(component: Component): string {
  return [
    titleCase(component.type),
    component.size,
    component.manufacturer,
    component.model,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ComponentRegistry({ holeId }: { holeId: string }) {
  const [items, setItems] = useState<readonly RegistryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const registryHref = runbookRoutes.componentRegistry(holeId);
  const addHref = `/components/new?type=BIT&holeId=${encodeURIComponent(
    holeId,
  )}&returnTo=${encodeURIComponent(registryHref)}`;

  useEffect(() => {
    let cancelled = false;
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() => {
        if (!cancelled) setError("Browser storage is unavailable.");
      });
      return () => {
        cancelled = true;
      };
    }

    void services.components
      .list()
      .then(async (components) => {
        const assignments = await Promise.all(
          components.map((component) =>
            services.componentAssignments.listByComponent(component.localId),
          ),
        );
        if (!cancelled) {
          setItems(
            components.map((component, index) => ({
              component,
              assignments: assignments[index] ?? [],
            })),
          );
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The component registry could not load.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5" data-testid="component-registry">
      <StagePageHeader
        eyebrow="Organisation inventory"
        title="Component Registry"
        description="Review bit and reamer serials across holes, including current status and assignment history."
        backTarget={{ href: runbookRoutes.more(holeId), label: "More" }}
        action={
          <Link href={addHref} className={primaryActionClass}>
            <CirclePlus aria-hidden="true" className="size-4" />
            Add component
          </Link>
        }
      />

      {error ? (
        <StatePanel
          state="error"
          title="Component registry unavailable"
          description={error}
        />
      ) : items === null ? (
        <StatePanel state="loading" title="Loading component registry" />
      ) : items.length === 0 ? (
        <StatePanel
          state="empty"
          title="No components recorded"
          description="Add the first bit or reamer serial before assigning it to a hole."
          action={
            <Link href={addHref} className={primaryActionClass}>
              Add component
            </Link>
          }
        />
      ) : (
        <SectionPanel
          title="Bits and reamers"
          description={`${items.length} registered component${items.length === 1 ? "" : "s"}`}
          contentClassName="p-0"
        >
          <ul className="divide-y divide-[var(--tl-border)]">
            {items.map(({ component, assignments }) => {
              const activeAssignment = assignments.find(
                ({ status }) => status === "ACTIVE",
              );
              return (
                <li key={component.localId}>
                  <Link
                    href={runbookRoutes.componentDetail(
                      component.localId,
                      holeId,
                    )}
                    className="group flex min-h-20 items-center gap-3 px-4 py-3 text-[var(--tl-ink)] no-underline hover:bg-[var(--tl-surface-raised)] sm:px-5"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
                      <Wrench aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-all font-bold">
                        {component.serialNumber}
                      </span>
                      <span className="mt-0.5 block text-sm text-[var(--tl-ink-muted)]">
                        {componentDescription(component)}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-[var(--tl-ink-muted)]">
                        {activeAssignment
                          ? `Active in ${activeAssignment.holeId}`
                          : `${assignments.length} assignment${assignments.length === 1 ? "" : "s"}`}
                      </span>
                    </span>
                    <ComponentStatusPill status={component.status} />
                    <ArrowRight
                      aria-hidden="true"
                      className="size-5 shrink-0 text-[var(--tl-ink-muted)] transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionPanel>
      )}
    </div>
  );
}

export function ComponentDetail({
  componentId,
  holeId,
}: {
  componentId: string;
  holeId: string;
}) {
  const [data, setData] = useState<ComponentDetailData | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const services = createBrowserRunbookServices();
    if (services === null) {
      void Promise.resolve().then(() => {
        if (!cancelled) setError("Browser storage is unavailable.");
      });
      return () => {
        cancelled = true;
      };
    }

    void services.components
      .getById(componentId)
      .then(async (component) => {
        if (component === null) {
          if (!cancelled) setMissing(true);
          return;
        }
        const [assignments, corrections] = await Promise.all([
          services.componentAssignments.listByComponent(component.localId),
          services.components.listCorrections(component.localId),
        ]);
        if (!cancelled) {
          setData({
            component,
            assignments: [...assignments].sort(
              (left, right) =>
                Date.parse(right.installedAt) - Date.parse(left.installedAt),
            ),
            corrections,
          });
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The component record could not load.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [componentId]);

  const registryHref = runbookRoutes.componentRegistry(holeId);
  if (error) {
    return (
      <StatePanel
        state="error"
        title="Component unavailable"
        description={error}
        action={
          <Link href={registryHref} className={primaryActionClass}>
            Return to registry
          </Link>
        }
      />
    );
  }
  if (missing) {
    return (
      <StatePanel
        state="empty"
        title="Component not found"
        description="This component is not present in the local organisation registry."
        action={
          <Link href={registryHref} className={primaryActionClass}>
            Return to registry
          </Link>
        }
      />
    );
  }
  if (data === null) {
    return <StatePanel state="loading" title="Loading component" />;
  }

  const { component, assignments, corrections } = data;
  return (
    <div className="space-y-5" data-testid="component-detail">
      <StagePageHeader
        eyebrow={`${titleCase(component.type)} registry record`}
        title={component.serialNumber}
        description={componentDescription(component)}
        backTarget={{ href: registryHref, label: "Component registry" }}
        action={<ComponentStatusPill status={component.status} />}
      />

      <SectionPanel
        title="Component details"
        description="Organisation-shared identification and lifecycle values."
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Type", titleCase(component.type)],
            ["Size", component.size],
            ["Manufacturer", component.manufacturer ?? "—"],
            ["Model", component.model ?? "—"],
            ["Matrix", component.matrix ?? "—"],
            ["Supplier", component.supplier ?? "—"],
            [
              "Starting crown height",
              component.startingCrownHeightDm === undefined
                ? "—"
                : formatComponentDepth(component.startingCrownHeightDm),
            ],
            ["Recorded by", component.createdByNameSnapshot],
            ["Recorded", formatComponentDate(component.createdAt)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md bg-[var(--tl-surface-raised)] p-3"
            >
              <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                {label}
              </dt>
              <dd className="mt-1 break-words font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        {component.notes ? (
          <div className="mt-4 rounded-md border border-[var(--tl-border)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
              Notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{component.notes}</p>
          </div>
        ) : null}
      </SectionPanel>

      <SectionPanel
        title="Assignment history"
        description={`${assignments.length} recorded assignment${assignments.length === 1 ? "" : "s"} across all holes.`}
        contentClassName="p-0"
      >
        {assignments.length === 0 ? (
          <StatePanel
            state="empty"
            title="No assignment history"
            description="This component has not yet been installed in a hole."
            className="m-4"
          />
        ) : (
          <ul className="divide-y divide-[var(--tl-border)]">
            {assignments.map((assignment) => (
              <li key={assignment.localId} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
                      <Drill aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <Link
                        href={runbookRoutes.currentHole(assignment.holeId)}
                        className="font-bold text-[var(--tl-primary)]"
                      >
                        {assignment.holeId}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                        {formatComponentDepth(assignment.startDepthDm)} to{" "}
                        {assignment.endDepthDm === undefined
                          ? "active"
                          : formatComponentDepth(assignment.endDepthDm)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                    {titleCase(assignment.status)}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[var(--tl-ink-muted)]">
                  Installed {formatComponentDate(assignment.installedAt)} by{" "}
                  {assignment.installedByNameSnapshot}
                  {assignment.removalReason
                    ? ` · Removed: ${titleCase(assignment.removalReason)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      {corrections.length > 0 ? (
        <SectionPanel
          title="Corrections"
          description="Append-only changes retained against this registry record."
        >
          <ul className="space-y-3">
            {corrections.map((correction) => (
              <li
                key={correction.id}
                className="rounded-md border border-[var(--tl-border)] p-3 text-sm"
              >
                <p className="font-bold">{titleCase(correction.fieldName)}</p>
                <p className="mt-1 text-[var(--tl-ink-muted)]">
                  {correction.reason} · {correction.correctedByNameSnapshot} ·{" "}
                  {formatComponentDate(correction.correctedAt)}
                </p>
              </li>
            ))}
          </ul>
        </SectionPanel>
      ) : null}
    </div>
  );
}
