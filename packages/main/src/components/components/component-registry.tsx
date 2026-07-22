"use client";

import { PackageSearch, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  createBrowserRunbookServices,
  getComponentRegistry,
} from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { Input } from "@/components/ui/input";
import {
  calculateComponentUsage,
  summarizeComponentUsage,
  type Component,
  type ComponentStatus,
  type ComponentType,
  type Decimetres,
} from "@/domain";
import { targetLockStage3Seed } from "@/infrastructure/seed";

import {
  COMPONENT_STATUSES,
  COMPONENT_TYPES,
  ComponentStatusPill,
  OperationNotice,
  formatComponentDepth,
  readCompletedUsageRuns,
  titleCase,
} from "./component-support";

type FilterValue<T extends string> = T | "ALL";

interface RegistryDetail {
  readonly currentHole: string | null;
  readonly drilledMetresDm: Decimetres;
}

export function ComponentRegistry() {
  const [type, setType] = useState<FilterValue<ComponentType>>("ALL");
  const [status, setStatus] =
    useState<FilterValue<ComponentStatus>>("ALL");
  const [search, setSearch] = useState("");
  const [components, setComponents] = useState<readonly Component[]>([]);
  const [details, setDetails] = useState<
    Readonly<Record<string, RegistryDetail>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadTimer = window.setTimeout(() => {
      const services = createBrowserRunbookServices();
      if (services === null) {
        setError("Browser storage is unavailable. The registry cannot be loaded.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      void getComponentRegistry(
        {
          type: type === "ALL" ? undefined : type,
          status: status === "ALL" ? undefined : status,
          search,
        },
        services,
      )
        .then(async (records) => {
          const completedRuns = readCompletedUsageRuns(
            targetLockStage3Seed.hole.name,
            services,
          );
          const registryDetails = await Promise.all(
            records.map(async (component) => {
              const assignments =
                await services.componentAssignments.listByComponent(
                  component.localId,
                );
              const usage = assignments.map((assignment) =>
                calculateComponentUsage(
                  assignment,
                  assignment.holeId === targetLockStage3Seed.hole.name
                    ? completedRuns
                    : [],
                ),
              );
              return [
                component.localId,
                {
                  currentHole:
                    assignments.find(({ status }) => status === "ACTIVE")
                      ?.holeId ?? null,
                  drilledMetresDm: summarizeComponentUsage(usage)
                    .drilledMetresDm,
                },
              ] as const;
            }),
          );
          if (active) {
            setComponents(records);
            setDetails(Object.fromEntries(registryDetails));
          }
        })
        .catch((cause: unknown) => {
          if (active) {
            setError(
              cause instanceof Error
                ? cause.message
                : "The component registry could not be loaded.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(loadTimer);
    };
  }, [search, status, type]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 3 · component control"
        title="Component registry"
        description="Search all bits and reamers registered to this organisation, including available, active, inspection, and retired equipment."
        action={
          <Link
            href="/components/new"
            className="tl-action-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--tl-radius-sm)] px-4 font-bold text-white no-underline"
          >
            <Plus aria-hidden="true" className="size-5" />
            Add component
          </Link>
        }
      />

      <section
        aria-labelledby="component-filters-heading"
        className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]"
      >
        <h2 id="component-filters-heading" className="sr-only">
          Registry filters
        </h2>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem_14rem]">
          <div>
            <label
              htmlFor="component-search"
              className="mb-2 block text-sm font-bold text-[var(--tl-ink)]"
            >
              Search components
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[var(--tl-ink-muted)]"
              />
              <Input
                id="component-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Serial, manufacturer, model, or matrix"
                className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] pl-10 text-base text-[var(--tl-ink)]"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="component-type-filter"
              className="mb-2 block text-sm font-bold text-[var(--tl-ink)]"
            >
              Type
            </label>
            <select
              id="component-type-filter"
              value={type}
              onChange={(event) =>
                setType(event.target.value as FilterValue<ComponentType>)
              }
              className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base text-[var(--tl-ink)]"
            >
              <option value="ALL">All types</option>
              {COMPONENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="component-status-filter"
              className="mb-2 block text-sm font-bold text-[var(--tl-ink)]"
            >
              Status
            </label>
            <select
              id="component-status-filter"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as FilterValue<ComponentStatus>)
              }
              className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base text-[var(--tl-ink)]"
            >
              <option value="ALL">All statuses</option>
              {COMPONENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error ? <OperationNotice tone="error">{error}</OperationNotice> : null}

      <section aria-labelledby="component-results-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="component-results-heading"
            className="text-lg font-bold text-[var(--tl-ink)]"
          >
            Registry results
          </h2>
          <p role="status" aria-live="polite" className="text-sm text-[var(--tl-ink-muted)]">
            {loading
              ? "Loading components…"
              : `${components.length} component${components.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {!loading && components.length === 0 && !error ? (
          <div className="rounded-[var(--tl-radius-lg)] border border-dashed border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-8 text-center">
            <PackageSearch
              aria-hidden="true"
              className="mx-auto size-8 text-[var(--tl-ink-muted)]"
            />
            <p className="mt-3 font-bold text-[var(--tl-ink)]">
              No components match these filters
            </p>
            <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
              Clear a filter or add a new registry record.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 lg:hidden">
          {components.map((component) => (
            <article
              key={component.localId}
              className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-primary)]">
                    {titleCase(component.type)}
                  </p>
                  <h3 className="mt-1 break-all text-lg font-bold text-[var(--tl-ink)]">
                    {component.serialNumber}
                  </h3>
                </div>
                <ComponentStatusPill status={component.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="font-semibold text-[var(--tl-ink-muted)]">Make / model</dt>
                  <dd className="mt-0.5 text-[var(--tl-ink)]">
                    {[component.manufacturer, component.model].filter(Boolean).join(" · ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--tl-ink-muted)]">Size / matrix</dt>
                  <dd className="mt-0.5 text-[var(--tl-ink)]">
                    {component.size}
                    {component.matrix ? ` · ${component.matrix}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--tl-ink-muted)]">
                    Current hole
                  </dt>
                  <dd className="mt-0.5 text-[var(--tl-ink)]">
                    {details[component.localId]?.currentHole ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--tl-ink-muted)]">
                    Recorded metres
                  </dt>
                  <dd className="mt-0.5 text-[var(--tl-ink)]">
                    {details[component.localId] === undefined
                      ? "—"
                      : formatComponentDepth(
                          details[component.localId].drilledMetresDm,
                        )}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/components/${encodeURIComponent(component.localId)}`}
                className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
              >
                View history and statistics
              </Link>
            </article>
          ))}
        </div>

        {components.length > 0 ? (
          <div className="hidden overflow-x-auto rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] lg:block">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-[var(--tl-surface-raised)] text-xs uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Serial</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Make / model</th>
                  <th className="px-4 py-3 font-bold">Size / matrix</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Current hole</th>
                  <th className="px-4 py-3 text-right font-bold">Recorded metres</th>
                  <th className="px-4 py-3 font-bold"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--tl-border)]">
                {components.map((component) => (
                  <tr key={component.localId}>
                    <th scope="row" className="px-4 py-3 font-bold text-[var(--tl-ink)]">
                      {component.serialNumber}
                    </th>
                    <td className="px-4 py-3">{titleCase(component.type)}</td>
                    <td className="px-4 py-3">
                      {[component.manufacturer, component.model].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {component.size}
                      {component.matrix ? ` · ${component.matrix}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <ComponentStatusPill status={component.status} />
                    </td>
                    <td className="px-4 py-3">
                      {details[component.localId]?.currentHole ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {details[component.localId] === undefined
                        ? "—"
                        : formatComponentDepth(
                            details[component.localId].drilledMetresDm,
                          )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/components/${encodeURIComponent(component.localId)}`}
                        className="inline-flex min-h-11 items-center font-bold text-[var(--tl-primary)]"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
