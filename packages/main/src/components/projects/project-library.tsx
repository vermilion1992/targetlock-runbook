"use client";

import {
  ArrowRight,
  CirclePlus,
  Drill,
  FolderKanban,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { SectionPanel } from "@/components/field/section-panel";
import { StatePanel } from "@/components/field/state-panel";
import { StatusPill } from "@/components/field/status-pill";
import {
  HOLE_STATUS_LABELS,
  type HoleStatus,
  type Project,
  type Rig,
} from "@/domain";
import type { CanonicalHole } from "@/infrastructure/completion";

interface ProjectLibraryProps {
  projectId?: string;
}

interface LibraryData {
  projects: readonly Project[];
  holes: readonly CanonicalHole[];
}

interface ProjectData {
  project: Project;
  rigs: readonly Rig[];
  holes: readonly CanonicalHole[];
}

const primaryActionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--tl-primary)] px-4 py-2 text-sm font-semibold text-white no-underline";

function statusTone(
  status: HoleStatus,
): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DRAFT":
      return "info";
    case "SUSPENDED":
    case "COMPLETION_REVIEW":
      return "warning";
    case "ABANDONED":
      return "danger";
    case "COMPLETED":
    case "ARCHIVED":
      return "neutral";
  }
}

function sortHoles(holes: readonly CanonicalHole[]): readonly CanonicalHole[] {
  const priority: Record<HoleStatus, number> = {
    ACTIVE: 0,
    DRAFT: 1,
    SUSPENDED: 2,
    COMPLETION_REVIEW: 3,
    COMPLETED: 4,
    ABANDONED: 5,
    ARCHIVED: 6,
  };
  return [...holes].sort(
    (left, right) =>
      priority[left.status] - priority[right.status] ||
      left.name.localeCompare(right.name, "en-AU"),
  );
}

export function ProjectLibrary({ projectId }: ProjectLibraryProps) {
  if (projectId) {
    return <ProjectHoleLibrary projectId={projectId} />;
  }
  return <ProjectIndex />;
}

function ProjectIndex() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const services = createBrowserRunbookServices();
    if (!services) {
      void Promise.resolve().then(() => {
        if (!cancelled) setError("Browser storage is unavailable.");
      });
      return () => {
        cancelled = true;
      };
    }
    void Promise.all([
      services.projects.listProjects(),
      services.completion.listHoles(),
    ])
      .then(([projects, holes]) => {
        if (!cancelled) setData({ projects, holes });
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The project library could not load.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5" data-testid="project-library">
      <StagePageHeader
        eyebrow="Operations"
        title="Project Library"
        description="Choose a project to see its rigs, active work and complete hole history."
        action={
          <Link href="/projects/new" className={primaryActionClass}>
            <CirclePlus aria-hidden="true" className="size-4" />
            New project
          </Link>
        }
      />
      {error ? (
        <StatePanel state="error" title="Project library unavailable" description={error} />
      ) : data === null ? (
        <StatePanel state="loading" title="Loading projects" />
      ) : data.projects.length === 0 ? (
        <StatePanel
          state="empty"
          title="No projects available"
          description="Create a project with its first rig to begin planning holes."
          action={
            <Link href="/projects/new" className={primaryActionClass}>
              <CirclePlus aria-hidden="true" className="size-4" />
              Create project
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.projects.map((project) => {
            const holes = data.holes.filter(
              (hole) => hole.projectId === project.localId,
            );
            const open = holes.filter(
              ({ status }) =>
                status === "ACTIVE" ||
                status === "DRAFT" ||
                status === "SUSPENDED" ||
                status === "COMPLETION_REVIEW",
            ).length;
            return (
              <Link
                key={project.localId}
                href={`/projects/${encodeURIComponent(project.localId)}`}
                className="group rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-5 text-[var(--tl-ink)] no-underline shadow-[var(--tl-shadow-sm)] transition-colors hover:border-[var(--tl-primary)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-11 items-center justify-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
                    <FolderKanban aria-hidden="true" className="size-5" />
                  </span>
                  <StatusPill tone={project.status === "active" ? "success" : "neutral"}>
                    {project.status}
                  </StatusPill>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
                  {project.code}
                </p>
                <h2 className="mt-1 text-xl font-bold">{project.name}</h2>
                <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                  {project.clientName}
                </p>
                <p className="mt-3 flex items-center gap-2 text-sm text-[var(--tl-ink-muted)]">
                  <MapPin aria-hidden="true" className="size-4" />
                  {project.location}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-[var(--tl-border)] pt-4 text-sm">
                  <span>
                    <strong>{open}</strong> open · <strong>{holes.length}</strong>{" "}
                    total holes
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-5 transition-transform group-hover:translate-x-1"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectHoleLibrary({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const services = createBrowserRunbookServices();
    if (!services) {
      void Promise.resolve().then(() => {
        if (!cancelled) setError("Browser storage is unavailable.");
      });
      return () => {
        cancelled = true;
      };
    }
    void Promise.all([
      services.projects.getProject(projectId),
      services.projects.listRigs(projectId),
      services.completion.listHoles(),
    ])
      .then(([project, rigs, holes]) => {
        if (cancelled) return;
        if (!project) {
          setError("This project does not exist or is not available here.");
          return;
        }
        setData({
          project,
          rigs,
          holes: sortHoles(
            holes.filter((hole) => hole.projectId === project.localId),
          ),
        });
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The project could not load.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const newHoleHref = `/projects/${encodeURIComponent(projectId)}/holes/new`;

  return (
    <div className="space-y-5" data-testid="project-hole-library">
      <StagePageHeader
        eyebrow={data?.project.code ?? "Project"}
        title={data?.project.name ?? "Project Holes"}
        description={
          data
            ? `${data.project.clientName} · ${data.project.location}`
            : "Loading the project's hole register."
        }
        backTarget={{ href: "/projects", label: "Project library" }}
        action={
          data ? (
            <Link href={newHoleHref} className={primaryActionClass}>
              <CirclePlus aria-hidden="true" className="size-4" />
              New hole
            </Link>
          ) : null
        }
      />
      {error ? (
        <StatePanel
          state="error"
          title="Project unavailable"
          description={error}
          action={
            <Link href="/projects" className={primaryActionClass}>
              Return to projects
            </Link>
          }
        />
      ) : data === null ? (
        <StatePanel state="loading" title="Loading project holes" />
      ) : (
        <SectionPanel
          title="Hole register"
          description={`${data.rigs.length} rig${data.rigs.length === 1 ? "" : "s"} · ${data.holes.length} hole${data.holes.length === 1 ? "" : "s"}`}
          action={
            <Link href={newHoleHref} className={primaryActionClass}>
              <CirclePlus aria-hidden="true" className="size-4" />
              New hole
            </Link>
          }
          contentClassName="p-0"
        >
          {data.holes.length === 0 ? (
            <StatePanel
              state="empty"
              title="No holes in this project"
              description="Create the first draft hole when the design and rig are known."
              action={
                <Link href={newHoleHref} className={primaryActionClass}>
                  Create hole
                </Link>
              }
              className="m-4"
            />
          ) : (
            <ul className="divide-y divide-[var(--tl-border)]">
              {data.holes.map((hole) => {
                const rig = data.rigs.find(
                  (candidate) => candidate.localId === hole.rigId,
                );
                return (
                  <li key={hole.localId}>
                    <Link
                      href={runbookRoutes.currentHole(hole.localId)}
                      className="group flex min-h-20 items-center gap-3 px-4 py-3 text-[var(--tl-ink)] no-underline hover:bg-[var(--tl-surface-raised)] sm:px-5"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--tl-surface-sunken)] text-[var(--tl-primary)]">
                        <Drill aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">
                          {hole.name}
                        </span>
                        <span className="mt-0.5 block text-sm text-[var(--tl-ink-muted)]">
                          {rig?.name ?? hole.rigId} · {hole.holeSize} ·{" "}
                          {(hole.plannedDepth / 10).toFixed(1)} m planned
                        </span>
                      </span>
                      <StatusPill tone={statusTone(hole.status)}>
                        {HOLE_STATUS_LABELS[hole.status]}
                      </StatusPill>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-5 shrink-0 text-[var(--tl-ink-muted)] transition-transform group-hover:translate-x-1"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionPanel>
      )}
    </div>
  );
}
