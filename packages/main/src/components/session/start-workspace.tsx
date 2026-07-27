"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  CirclePlus,
  Drill,
  FolderKanban,
  MapPin,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  createBrowserRunbookServices,
  deriveDrillingReadiness,
  getCurrentHoleState,
  type CurrentHoleState,
} from "@/application/runbook";
import { StatePanel } from "@/components/field/state-panel";
import { StatusPill } from "@/components/field/status-pill";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HOLE_STATUS_LABELS,
  type HoleStatus,
  type Project,
  type Rig,
} from "@/domain";
import type { CanonicalHole } from "@/infrastructure/completion";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { useOperatorSession } from "./operator-session-provider";

interface HoleChoice {
  readonly hole: CanonicalHole;
  readonly project: Project | null;
  readonly rig: Rig | null;
}

interface WorkspaceData {
  readonly projects: readonly Project[];
  readonly holes: readonly HoleChoice[];
  readonly recentState: CurrentHoleState | null;
}

interface Destination {
  readonly choice: HoleChoice;
  readonly href: string;
  readonly actionLabel: string;
  readonly reason: string;
}

function statusTone(
  status: HoleStatus,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "DRAFT") return "info";
  if (status === "SUSPENDED" || status === "COMPLETION_REVIEW") return "warning";
  if (status === "ABANDONED") return "danger";
  return "neutral";
}

function destinationFor(
  choice: HoleChoice,
  state: CurrentHoleState | null,
): Destination {
  const locked =
    choice.hole.status === "COMPLETED" ||
    choice.hole.status === "ABANDONED" ||
    choice.hole.status === "ARCHIVED";
  if (locked || state === null) {
    return {
      choice,
      href: runbookRoutes.currentHole(choice.hole.localId),
      actionLabel: `Open ${choice.hole.name}`,
      reason: locked
        ? "Review the completed hole record."
        : "Open the hole overview.",
    };
  }
  if (
    choice.hole.status !== "ACTIVE" &&
    choice.hole.status !== "DRAFT"
  ) {
    return {
      choice,
      href: runbookRoutes.currentHole(choice.hole.localId),
      actionLabel: `Review ${choice.hole.name}`,
      reason: "Review the hole lifecycle before continuing drilling work.",
    };
  }
  const readiness = deriveDrillingReadiness({
    holeStatus: choice.hole.status,
    bhaSetup: state.bhaSetup,
  });
  if (!readiness.ready) {
    return {
      choice,
      href: runbookRoutes.updateBha(choice.hole.localId),
      actionLabel: "Complete BHA setup",
      reason: `Continue ${choice.hole.name} by recording BHA length and constant stick-up.`,
    };
  }
  if (state.pendingHandover) {
    return {
      choice,
      href: runbookRoutes.handover(choice.hole.localId),
      actionLabel: "Review handover",
      reason: `Accept the pending handover for ${choice.hole.name}.`,
    };
  }
  if (state.activeShift) {
    return {
      choice,
      href: runbookRoutes.recordRun(choice.hole.localId),
      actionLabel: "Record next run",
      reason: `Continue ${choice.hole.name} on the active ${state.activeShift.shiftType === "DAY" ? "Day" : "Night"} Shift.`,
    };
  }
  return {
    choice,
    href: runbookRoutes.startShift(choice.hole.localId),
    actionLabel: "Start shift",
    reason: `Continue ${choice.hole.name} by assigning the next field shift.`,
  };
}

export function StartWorkspace() {
  const router = useRouter();
  const { session } = useOperatorSession();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chooseHoleOpen, setChooseHoleOpen] = useState(false);
  const [newHoleOpen, setNewHoleOpen] = useState(false);
  const [pendingDestination, setPendingDestination] =
    useState<Destination | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [checkingHoleId, setCheckingHoleId] = useState<string | null>(null);

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
    void Promise.all([
      services.projects.listProjects(),
      services.completion.listHoles(),
    ])
      .then(async ([projects, holes]) => {
        const rigs = await Promise.all(
          projects.map((project) => services.projects.listRigs(project.localId)),
        );
        const allRigs = rigs.flat();
        const choices = holes
          .map((hole) => ({
            hole,
            project:
              projects.find(({ localId }) => localId === hole.projectId) ?? null,
            rig:
              allRigs.find(({ localId }) => localId === hole.rigId) ?? null,
          }))
          .sort(
            (left, right) =>
              left.project?.name.localeCompare(
                right.project?.name ?? "",
                "en-AU",
              ) || left.hole.name.localeCompare(right.hole.name, "en-AU"),
          );
        const recentChoice = choices.find(
          ({ hole }) => hole.localId === session?.lastHoleId,
        );
        const recentState =
          recentChoice === undefined
            ? null
            : await getCurrentHoleState(
                recentChoice.hole.localId,
                services.currentState,
              );
        if (!cancelled) {
          setData({ projects, holes: choices, recentState });
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The field workspace could not be loaded.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session?.lastHoleId]);

  const recentChoice = useMemo(
    () =>
      data?.holes.find(({ hole }) => hole.localId === session?.lastHoleId) ??
      null,
    [data?.holes, session?.lastHoleId],
  );
  const recentDestination =
    recentChoice === null
      ? null
      : destinationFor(recentChoice, data?.recentState ?? null);

  async function prepareHoleDestination(choice: HoleChoice) {
    if (checkingHoleId !== null) return;
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    setCheckingHoleId(choice.hole.localId);
    try {
      const state = await getCurrentHoleState(
        choice.hole.localId,
        services.currentState,
      );
      setPendingDestination(destinationFor(choice, state));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The selected hole state could not be loaded.",
      );
    } finally {
      setCheckingHoleId(null);
    }
  }

  if (error) {
    return (
      <StatePanel
        state="error"
        title="Start workspace unavailable"
        description={error}
      />
    );
  }
  if (data === null || session === null) {
    return <StatePanel state="loading" title="Preparing field workspace" />;
  }

  const openHoleChoices = data.holes.filter(
    ({ hole }) =>
      hole.status !== "COMPLETED" &&
      hole.status !== "ABANDONED" &&
      hole.status !== "ARCHIVED",
  );

  return (
    <div className="space-y-5 sm:space-y-6" data-testid="start-workspace">
      <header className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-5 shadow-[var(--tl-shadow-sm)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--tl-primary)]">
              Field start
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">
              Welcome, {session.operator.displayName}
            </h1>
            <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
              Confirm the hole before opening its runbook or start something
              new.
            </p>
          </div>
        </div>
      </header>

      {recentDestination ? (
        <section
          aria-labelledby="continue-heading"
          className="overflow-hidden rounded-[var(--tl-radius-lg)] border-2 border-[var(--tl-primary)] bg-[var(--tl-surface)] shadow-[var(--tl-shadow-md)]"
        >
          <div className="bg-[var(--tl-primary-soft)] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--tl-primary)]">
                  Continue recent hole
                </p>
                <h2
                  id="continue-heading"
                  className="mt-1 text-2xl font-extrabold"
                >
                  {recentDestination.choice.hole.name}
                </h2>
              </div>
              <StatusPill
                tone={statusTone(recentDestination.choice.hole.status)}
              >
                {HOLE_STATUS_LABELS[recentDestination.choice.hole.status]}
              </StatusPill>
            </div>
            <p className="mt-3 text-sm font-semibold">
              {recentDestination.reason}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                  Project
                </dt>
                <dd className="mt-1 truncate font-bold">
                  {recentDestination.choice.project?.name ?? "Unknown project"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                  Rig
                </dt>
                <dd className="mt-1 truncate font-bold">
                  {recentDestination.choice.rig?.name ?? "Unknown rig"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="p-4 sm:p-5">
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-5 font-bold text-white"
              onClick={() => setPendingDestination(recentDestination)}
            >
              <span>{recentDestination.actionLabel}</span>
              <ArrowRight aria-hidden="true" className="size-5" />
            </button>
          </div>
        </section>
      ) : (
        <StatePanel
          state="empty"
          title="No recent hole on this operator profile"
          description="Choose an existing hole or create a new one inside a project."
        />
      )}

      <section aria-labelledby="start-actions-heading">
        <h2
          id="start-actions-heading"
          className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--tl-ink-muted)]"
        >
          Other actions
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="flex min-h-20 items-center gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-4 text-left shadow-[var(--tl-shadow-sm)]"
            onClick={() => setChooseHoleOpen(true)}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
              <Drill aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block font-bold">Choose another hole</span>
              <span className="mt-1 block text-xs text-[var(--tl-ink-muted)]">
                {openHoleChoices.length} open
              </span>
            </span>
          </button>
          <button
            type="button"
            className="flex min-h-20 items-center gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-4 text-left shadow-[var(--tl-shadow-sm)]"
            onClick={() => setNewHoleOpen(true)}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
              <CirclePlus aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block font-bold">New drill hole</span>
              <span className="mt-1 block text-xs text-[var(--tl-ink-muted)]">
                Select its project first
              </span>
            </span>
          </button>
          <button
            type="button"
            className="flex min-h-20 items-center gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-4 text-left shadow-[var(--tl-shadow-sm)]"
            onClick={() => router.push("/projects/new")}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
              <FolderKanban aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block font-bold">New project</span>
              <span className="mt-1 block text-xs text-[var(--tl-ink-muted)]">
                Includes its first rig
              </span>
            </span>
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <FolderKanban
            aria-hidden="true"
            className="size-5 text-[var(--tl-primary)]"
          />
          <span>
            <strong>{data.projects.length}</strong> projects ·{" "}
            <strong>{data.holes.length}</strong> holes on this device
          </span>
        </div>
        <button
          type="button"
          className="min-h-11 text-left font-bold text-[var(--tl-primary)] sm:text-right"
          onClick={() => router.push("/projects")}
        >
          Open project library
        </button>
      </div>

      <Dialog
        open={pendingDestination !== null && !chooseHoleOpen}
        onOpenChange={(open) => {
          if (!open && !chooseHoleOpen) setPendingDestination(null);
        }}
      >
        <DecisionDialogContent>
          {pendingDestination ? (
            <div className="p-5 sm:p-6">
              <DialogHeader>
                <DialogTitle className="pr-8 text-xl">
                  Open {pendingDestination.choice.hole.name}?
                </DialogTitle>
                <DialogDescription className="text-[var(--tl-ink-muted)]">
                  Confirm the operational context before entering this hole.
                </DialogDescription>
              </DialogHeader>
              <HoleConfirmation choice={pendingDestination.choice} />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="min-h-12 rounded-md border border-[var(--tl-border-strong)] font-bold"
                  onClick={() => setPendingDestination(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tl-primary)] px-4 font-bold text-white"
                  onClick={() => router.push(pendingDestination.href)}
                >
                  {pendingDestination.actionLabel}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
          ) : null}
        </DecisionDialogContent>
      </Dialog>

      <Dialog
        open={chooseHoleOpen}
        onOpenChange={(open) => {
          setChooseHoleOpen(open);
          if (!open) setPendingDestination(null);
        }}
      >
        <DecisionDialogContent>
          <div className="p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle className="pr-8 text-xl">
                {pendingDestination
                  ? `Open ${pendingDestination.choice.hole.name}?`
                  : "Choose a hole"}
              </DialogTitle>
              <DialogDescription className="text-[var(--tl-ink-muted)]">
                {pendingDestination
                  ? "Confirm the project and rig before switching context."
                  : "Select an open hole, then confirm before entering it."}
              </DialogDescription>
            </DialogHeader>
            {pendingDestination ? (
              <>
                <HoleConfirmation choice={pendingDestination.choice} />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-[var(--tl-border-strong)] font-bold"
                    onClick={() => setPendingDestination(null)}
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tl-primary)] px-4 font-bold text-white"
                    onClick={() => router.push(pendingDestination.href)}
                  >
                    Open hole
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </>
            ) : openHoleChoices.length === 0 ? (
              <div className="mt-5">
                <StatePanel
                  state="empty"
                  title="No open holes"
                  description="Create a new hole inside an existing project."
                />
              </div>
            ) : (
              <ul className="mt-5 max-h-[55dvh] space-y-2 overflow-y-auto">
                {openHoleChoices.map((choice) => (
                  <li key={choice.hole.localId}>
                    <button
                      type="button"
                      disabled={checkingHoleId !== null}
                      className="flex min-h-16 w-full items-center gap-3 rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-3 text-left"
                      onClick={() => void prepareHoleDestination(choice)}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
                        <Drill aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">
                          {checkingHoleId === choice.hole.localId
                            ? `Checking ${choice.hole.name}…`
                            : choice.hole.name}
                        </span>
                        <span className="block truncate text-xs text-[var(--tl-ink-muted)]">
                          {choice.project?.name ?? "Unknown project"} ·{" "}
                          {choice.rig?.name ?? "Unknown rig"}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DecisionDialogContent>
      </Dialog>

      <Dialog
        open={newHoleOpen}
        onOpenChange={(open) => {
          setNewHoleOpen(open);
          if (!open) setSelectedProject(null);
        }}
      >
        <DecisionDialogContent>
          <div className="p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle className="pr-8 text-xl">
                {selectedProject
                  ? `Create a hole in ${selectedProject.name}?`
                  : "Select the project"}
              </DialogTitle>
              <DialogDescription className="text-[var(--tl-ink-muted)]">
                Every hole must belong to a project before its ID and drilling
                setup can be recorded.
              </DialogDescription>
            </DialogHeader>
            {data.projects.length === 0 ? (
              <div className="mt-5">
                <StatePanel
                  state="empty"
                  title="Create your first project"
                  description="A project and its initial rig are required before a drill hole can be created."
                  action={
                    <button
                      type="button"
                      className="min-h-12 rounded-md bg-[var(--tl-primary)] px-5 font-bold text-white"
                      onClick={() => router.push("/projects/new")}
                    >
                      Create project
                    </button>
                  }
                />
              </div>
            ) : selectedProject ? (
              <>
                <div className="mt-5 rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-4">
                  <p className="font-bold">{selectedProject.name}</p>
                  <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                    {selectedProject.code} · {selectedProject.clientName}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <MapPin aria-hidden="true" className="size-4" />
                    {selectedProject.location}
                  </p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-[var(--tl-border-strong)] font-bold"
                    onClick={() => setSelectedProject(null)}
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tl-primary)] px-4 font-bold text-white"
                    onClick={() =>
                      router.push(
                        `/projects/${encodeURIComponent(selectedProject.localId)}/holes/new`,
                      )
                    }
                  >
                    Continue
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </>
            ) : (
              <ul className="mt-5 max-h-[55dvh] space-y-2 overflow-y-auto">
                {data.projects.map((project) => (
                  <li key={project.localId}>
                    <button
                      type="button"
                      className="flex min-h-16 w-full items-center gap-3 rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-3 text-left"
                      onClick={() => setSelectedProject(project)}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
                        <FolderKanban aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">
                          {project.name}
                        </span>
                        <span className="block truncate text-xs text-[var(--tl-ink-muted)]">
                          {project.code} · {project.clientName}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DecisionDialogContent>
      </Dialog>
    </div>
  );
}

function DecisionDialogContent({ children }: { children: ReactNode }) {
  return (
    <DialogPortal>
      <DialogOverlay className="bg-black/60 backdrop-blur-[1px]" />
      <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] text-[var(--tl-ink)] shadow-[var(--tl-shadow-md)] outline-none sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--tl-radius-lg)]">
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-[var(--tl-surface-raised)] text-[var(--tl-ink)]">
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function HoleConfirmation({ choice }: { choice: HoleChoice }) {
  return (
    <div className="mt-5 rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold">{choice.hole.name}</p>
          <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
            {choice.project?.name ?? "Unknown project"}
          </p>
        </div>
        <StatusPill tone={statusTone(choice.hole.status)}>
          {HOLE_STATUS_LABELS[choice.hole.status]}
        </StatusPill>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
            Rig
          </dt>
          <dd className="mt-1 font-bold">
            {choice.rig?.name ?? "Unknown rig"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
            Planned depth
          </dt>
          <dd className="mt-1 font-bold">
            {(choice.hole.plannedDepth / 10).toFixed(1)} m
          </dd>
        </div>
      </dl>
      <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-[var(--tl-ink-muted)]">
        <CheckCircle2 aria-hidden="true" className="size-4 text-[var(--tl-primary)]" />
        Hole ID {choice.hole.localId}
      </p>
    </div>
  );
}
