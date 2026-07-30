"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  CirclePlus,
  Drill,
  FilePlus2,
  FolderKanban,
  MapPin,
  ShieldCheck,
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
import { StagePageHeader } from "@/components/holes/stage-page-header";
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
import type { OperatorRole } from "@/infrastructure/session";
import type { StartHoleDestination } from "@/components/navigation/resolve-sign-in-destination";
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

function roleLabel(role: OperatorRole): string {
  return role === "SUPERVISOR" ? "Supervisor" : "Driller";
}

function serverRoleLabel(
  role: "COMPANY_ADMIN" | "SUPERVISOR" | "DRILLER",
): string {
  if (role === "COMPANY_ADMIN") return "Company admin";
  return role === "SUPERVISOR" ? "Supervisor" : "Driller";
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

export function StartWorkspace({
  requestedDestination = null,
  notice = null,
}: {
  requestedDestination?: StartHoleDestination | null;
  notice?: "access-denied" | "device-required" | "configuration" | null;
}) {
  const router = useRouter();
  const { runtimeMode, session, pilot } = useOperatorSession();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chooseHoleOpen, setChooseHoleOpen] = useState(false);
  const [newHoleOpen, setNewHoleOpen] = useState(false);
  const [newHoleMode, setNewHoleMode] = useState<
    "standard" | "client-plan"
  >("standard");
  const [pendingDestination, setPendingDestination] =
    useState<Destination | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [checkingHoleId, setCheckingHoleId] = useState<string | null>(null);
  const [requestedDecisionHandled, setRequestedDecisionHandled] =
    useState(false);
  const [coreRefresh, setCoreRefresh] = useState(0);

  useEffect(() => {
    const refreshFromServer = () => setCoreRefresh((value) => value + 1);
    window.addEventListener("targetlock:core-restored", refreshFromServer);
    return () =>
      window.removeEventListener("targetlock:core-restored", refreshFromServer);
  }, []);

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
  }, [coreRefresh, session?.lastHoleId]);

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

  function openClientPlanFlow() {
    setSelectedProject(null);
    if (pilot?.serverRole === "DRILLER") {
      if (
        !pilot.deviceVerified ||
        !pilot.device?.projectRef ||
        !pilot.device.rigRef
      ) {
        router.push(
          pilot.deviceVerified
            ? "/start?error=configuration"
            : "/start?device=required",
        );
        return;
      }
      router.push("/start/new-hole");
      return;
    }
    setNewHoleMode("client-plan");
    setNewHoleOpen(true);
  }

  function openStandardHoleFlow() {
    setSelectedProject(null);
    setNewHoleMode("standard");
    setNewHoleOpen(true);
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
  const otherOpenHoleChoices = openHoleChoices.filter(
    ({ hole }) => hole.localId !== recentChoice?.hole.localId,
  );
  const isSupervisor = session.operator.role === "SUPERVISOR";
  const requestedChoice =
    requestedDestination === null
      ? null
      : (data.holes.find(
          ({ hole }) => hole.localId === requestedDestination.holeId,
        ) ?? null);
  const requestedPendingDestination: Destination | null =
    requestedDestination !== null &&
    requestedChoice !== null &&
    !requestedDecisionHandled
      ? {
          choice: requestedChoice,
          href: requestedDestination.href,
          actionLabel: "Continue to requested page",
          reason:
            "This protected link requested a page inside this hole. Confirm the local work context before continuing.",
        }
      : null;
  const primaryPendingDestination =
    pendingDestination ?? requestedPendingDestination;
  const requestedHoleUnavailable =
    requestedDestination !== null && requestedChoice === null
      ? requestedDestination.holeId
      : null;

  return (
    <div className="space-y-5 sm:space-y-6" data-testid="start-workspace">
      <StagePageHeader
        eyebrow="Field workspace"
        title="Choose your work"
        description={`Welcome, ${session.operator.displayName}. Confirm the project, site, rig and hole before entering the runbook.${pilot ? ` ${pilot.organisationName}.` : ""}`}
        action={
          <StatusPill tone={isSupervisor ? "info" : "neutral"}>
            {pilot
              ? serverRoleLabel(pilot.serverRole)
              : roleLabel(session.operator.role)}
          </StatusPill>
        }
      />

      {notice ? (
        <section
          role="alert"
          className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-warning)] bg-[var(--tl-warning-soft)] p-4 text-[var(--tl-ink)]"
          data-testid={`pilot-${notice}`}
        >
          <h2 className="font-extrabold">
            {notice === "access-denied"
              ? "Supervisor access required"
              : notice === "device-required"
                ? "Register this rig tablet"
                : "Pilot configuration needs attention"}
          </h2>
          <p className="mt-1 text-sm">
            {notice === "access-denied"
              ? "Your signed-in role cannot open that setup or correction page. No field record was changed."
              : notice === "device-required"
                ? "Your account is verified, but field mutations, leases and server journaling require an active registered device."
                : "The secure pilot service is unavailable. Keep existing local records on this device and contact TargetLock support before continuing."}
          </p>
        </section>
      ) : null}

      {runtimeMode === "pilot" && pilot ? (
        <section
          aria-label="Controlled pilot status"
          className="grid gap-3 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] sm:grid-cols-[1fr_1fr_auto] sm:items-center"
          data-testid="pilot-context"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
              Organisation
            </p>
            <p className="mt-1 text-sm font-bold">{pilot.organisationName}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
              Field device
            </p>
            <p className="mt-1 text-sm font-bold">
              {pilot.device?.displayName ?? "Not registered"}
            </p>
            {pilot.device?.rigRef || pilot.device?.siteName ? (
              <p className="mt-0.5 text-xs text-[var(--tl-ink-muted)]">
                {[pilot.device.rigRef, pilot.device.siteName]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <StatusPill tone={pilot.deviceVerified ? "success" : "warning"}>
            {pilot.deviceVerified ? "Device verified" : "Registration required"}
          </StatusPill>
        </section>
      ) : null}

      {requestedHoleUnavailable ? (
        <StatePanel
          state="empty"
          title={`Hole ${requestedHoleUnavailable} is not available on this device`}
          description={
            isSupervisor
              ? "The saved link is safe, but its hole record is not stored here. Check the project library or set up the work on this device."
              : "The saved link is safe, but its hole record is not stored here. Contact a supervisor before starting work."
          }
        />
      ) : null}

      {recentDestination ? (
        <section
          aria-labelledby="continue-heading"
          className="overflow-hidden rounded-[var(--tl-radius-lg)] border-2 border-[var(--tl-primary)] bg-[var(--tl-surface)] shadow-[var(--tl-shadow-md)]"
        >
          <div className="bg-[var(--tl-primary-soft)] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--tl-primary)]">
                  Recent work on this device
                </p>
                <h2
                  id="continue-heading"
                  className="mt-1 text-2xl font-extrabold"
                >
                  {recentDestination.choice.hole.name}
                </h2>
                <p className="mt-1 text-xs font-semibold text-[var(--tl-ink-muted)]">
                  Hole ID {recentDestination.choice.hole.localId}
                </p>
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
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
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
                  Client / site
                </dt>
                <dd className="mt-1 font-bold">
                  {recentDestination.choice.project
                    ? `${recentDestination.choice.project.clientName} · ${recentDestination.choice.project.location}`
                    : "Unknown site"}
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
              <div>
                <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                  Operator role
                </dt>
                <dd className="mt-1 font-bold">
                  {roleLabel(session.operator.role)}
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
          className="min-h-40"
          title="No recent hole on this operator profile"
          description={
            isSupervisor
              ? "Choose work available on this device or use the supervisor setup controls below."
              : "Choose work available on this device. If the expected hole is missing, contact a supervisor."
          }
        />
      )}

      <section aria-labelledby="available-work-heading">
        <h2
          id="available-work-heading"
          className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--tl-ink-muted)]"
        >
          Start or switch work
        </h2>
        <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
          {pilot
            ? "Use work assigned to this device, or create a Draft from a client-issued hole plan."
            : "Choose local training work or create a Draft hole from a supplied plan."}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="flex min-h-20 items-center gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-4 text-left shadow-[var(--tl-shadow-sm)]"
            onClick={() => setChooseHoleOpen(true)}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
              <Drill aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block font-bold">Choose other work</span>
              <span className="mt-1 block text-xs text-[var(--tl-ink-muted)]">
                {otherOpenHoleChoices.length} other open hole
                {otherOpenHoleChoices.length === 1 ? "" : "s"}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="flex min-h-20 items-center gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-4 text-left shadow-[var(--tl-shadow-sm)] transition-colors hover:border-[var(--tl-primary)]"
            onClick={openClientPlanFlow}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
              <FilePlus2 aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block font-bold">Create hole from plan</span>
              <span className="mt-1 block text-xs text-[var(--tl-ink-muted)]">
                {pilot?.serverRole === "DRILLER"
                  ? "Uses this tablet's assigned project and rig"
                  : "Record a client-issued Draft hole"}
              </span>
            </span>
          </button>
        </div>
      </section>

      {isSupervisor ? (
        <section aria-labelledby="setup-work-heading" data-testid="setup-work">
          <div className="flex items-start gap-3">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-5 text-[var(--tl-primary)]"
            />
            <div>
              <h2 id="setup-work-heading" className="font-extrabold">
                Set up work
              </h2>
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                Supervisor-only workflow controls for this local prototype.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            className="flex min-h-20 items-center gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-4 text-left shadow-[var(--tl-shadow-sm)]"
            onClick={openStandardHoleFlow}
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
            onClick={() => router.push("/projects")}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
              <FolderKanban aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block font-bold">Project library</span>
              <span className="mt-1 block text-xs text-[var(--tl-ink-muted)]">
                Browse projects and hole registers
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
          {pilot ? (
            <button
              type="button"
              className="flex min-h-20 items-center gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] p-4 text-left shadow-[var(--tl-shadow-sm)]"
              onClick={() => router.push("/pilot-admin")}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block font-bold">Pilot administration</span>
                <span className="mt-1 block text-xs text-[var(--tl-ink-muted)]">
                  Users, devices, leases and backup
                </span>
              </span>
            </button>
          ) : null}
          </div>
        </section>
      ) : (
        <section
          aria-labelledby="driller-guidance-heading"
          className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-4"
          data-testid="driller-work-guidance"
        >
          <h2 id="driller-guidance-heading" className="font-bold">
            Assigned field access
          </h2>
          <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
            You can open an assigned hole or create a Draft from a client plan.
            Project, rig, correction and later configuration changes remain
            Supervisor actions.
          </p>
        </section>
      )}

      <div className="flex flex-col gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <FolderKanban
            aria-hidden="true"
            className="size-5 text-[var(--tl-primary)]"
          />
          <span>
            <strong>{data.projects.length}</strong> projects ·{" "}
            <strong>{data.holes.length}</strong> holes available on this device
          </span>
        </div>
        <span className="font-semibold text-[var(--tl-ink-muted)]">
          {pilot
            ? "Local-first field work · Authoritative core recovery"
            : "Local data only"}
        </span>
      </div>

      <Dialog
        open={primaryPendingDestination !== null && !chooseHoleOpen}
        onOpenChange={(open) => {
          if (!open && !chooseHoleOpen) {
            if (
              pendingDestination === null &&
              requestedPendingDestination !== null
            ) {
              setRequestedDecisionHandled(true);
            } else {
              setPendingDestination(null);
            }
          }
        }}
      >
        <DecisionDialogContent>
          {primaryPendingDestination ? (
            <>
              <DecisionDialogHeader
                icon={<CheckCircle2 aria-hidden="true" className="size-5" />}
                eyebrow="Final check"
                title={`Open ${primaryPendingDestination.choice.hole.name}?`}
                description="Confirm the operational context before entering this hole."
              />
              <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
              <HoleConfirmation
                choice={primaryPendingDestination.choice}
                role={session.operator.role}
              />
              </div>
              <DecisionDialogFooter>
                <button
                  type="button"
                  className="min-h-12 rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-4 font-bold transition-colors hover:border-[var(--tl-primary)]"
                  onClick={() => {
                    if (
                      pendingDestination === null &&
                      requestedPendingDestination !== null
                    ) {
                      setRequestedDecisionHandled(true);
                    } else {
                      setPendingDestination(null);
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tl-primary)] px-4 font-bold text-[var(--tl-light-ink)] shadow-[var(--tl-shadow-sm)] transition-colors hover:bg-[var(--tl-primary-deep)]"
                  onClick={() => router.push(primaryPendingDestination.href)}
                >
                  {primaryPendingDestination.actionLabel}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              </DecisionDialogFooter>
            </>
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
          <DecisionDialogHeader
            icon={<Drill aria-hidden="true" className="size-5" />}
            eyebrow={pendingDestination ? "Confirm work" : "Available work"}
            title={
              pendingDestination
                ? `Open ${pendingDestination.choice.hole.name}?`
                : "Choose a hole"
            }
            description={
              pendingDestination
                ? "Confirm the project and rig before switching field context."
                : "Select work available on this device. You will confirm its full context before entering."
            }
          />
          <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
            {pendingDestination ? (
              <HoleConfirmation
                choice={pendingDestination.choice}
                role={session.operator.role}
              />
            ) : otherOpenHoleChoices.length === 0 ? (
              <StatePanel
                state="empty"
                className="min-h-44"
                title="No other open work on this device"
                description={
                  isSupervisor
                    ? "Use Set up work to create a project-scoped hole."
                    : "Contact a supervisor if another hole should be available here."
                }
              />
            ) : (
              <ul className="space-y-3">
                {otherOpenHoleChoices.map((choice) => (
                  <li key={choice.hole.localId}>
                    <button
                      type="button"
                      disabled={checkingHoleId !== null}
                      className="group flex min-h-20 w-full items-center gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 text-left shadow-[var(--tl-shadow-sm)] transition-all hover:-translate-y-px hover:border-[var(--tl-primary)] hover:shadow-[var(--tl-shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tl-focus)] disabled:opacity-60"
                      onClick={() => void prepareHoleDestination(choice)}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)] transition-colors group-hover:bg-[var(--tl-primary)] group-hover:text-[var(--tl-light-ink)]">
                        <Drill aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="block truncate font-extrabold">
                            {checkingHoleId === choice.hole.localId
                              ? `Checking ${choice.hole.name}…`
                              : choice.hole.name}
                          </span>
                          <StatusPill tone={statusTone(choice.hole.status)}>
                            {HOLE_STATUS_LABELS[choice.hole.status]}
                          </StatusPill>
                        </span>
                        <span className="mt-1 block truncate text-sm font-semibold text-[var(--tl-ink-muted)]">
                          {choice.project?.name ?? "Unknown project"} ·{" "}
                          {choice.rig?.name ?? "Unknown rig"}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--tl-ink-muted)]">
                          {choice.project
                            ? `${choice.project.clientName} · ${choice.project.location}`
                            : "Unknown client / site"}
                        </span>
                      </span>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--tl-border)] text-[var(--tl-ink-muted)] transition-colors group-hover:border-[var(--tl-primary)] group-hover:text-[var(--tl-primary)]">
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {pendingDestination ? (
            <DecisionDialogFooter>
              <button
                type="button"
                className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-4 font-bold transition-colors hover:border-[var(--tl-primary)]"
                onClick={() => setPendingDestination(null)}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Back
              </button>
              <button
                type="button"
                className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tl-primary)] px-4 font-bold text-[var(--tl-light-ink)] shadow-[var(--tl-shadow-sm)] transition-colors hover:bg-[var(--tl-primary-deep)]"
                onClick={() => router.push(pendingDestination.href)}
              >
                Open hole
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </DecisionDialogFooter>
          ) : null}
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
          <DecisionDialogHeader
            icon={<FilePlus2 aria-hidden="true" className="size-5" />}
            eyebrow={
              newHoleMode === "client-plan"
                ? selectedProject
                  ? "Confirm project"
                  : "Client hole plan"
                : selectedProject
                  ? "Confirm project"
                  : "Hole setup"
            }
            title={
              selectedProject
                ? newHoleMode === "client-plan"
                  ? `Use ${selectedProject.name} for this plan?`
                  : `Create a hole in ${selectedProject.name}?`
                : newHoleMode === "client-plan"
                  ? "Where will this plan be drilled?"
                  : "Select the project"
            }
            description={
              newHoleMode === "client-plan"
                ? "Choose the existing project. The plan reference, rig and collar details are confirmed on the next page."
                : "Every hole must belong to a project before its ID and drilling setup can be recorded."
            }
          />
          <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
            {data.projects.length === 0 ? (
              <StatePanel
                state="empty"
                className="min-h-44"
                title="Create your first project"
                description="A project and its initial rig are required before a drill hole can be created."
                action={
                  isSupervisor ? (
                    <button
                      type="button"
                      className="min-h-12 rounded-md bg-[var(--tl-primary)] px-5 font-bold text-[var(--tl-light-ink)]"
                      onClick={() => router.push("/projects/new")}
                    >
                      Create project
                    </button>
                  ) : undefined
                }
              />
            ) : selectedProject ? (
              <div className="overflow-hidden rounded-[var(--tl-radius-lg)] border-2 border-[var(--tl-primary)] bg-[var(--tl-surface)] shadow-[var(--tl-shadow-sm)]">
                <div className="flex items-start gap-3 bg-[var(--tl-primary-soft)] p-4 sm:p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-surface)] text-[var(--tl-primary)]">
                    <FolderKanban aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold">
                      {selectedProject.name}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-primary)]">
                      {selectedProject.code}
                    </p>
                  </div>
                </div>
                <dl className="grid gap-4 p-4 text-sm sm:grid-cols-2 sm:p-5">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                      Client
                    </dt>
                    <dd className="mt-1 font-bold">
                      {selectedProject.clientName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-ink-muted)]">
                      Site / location
                    </dt>
                    <dd className="mt-1 flex items-center gap-2 font-bold">
                      <MapPin
                        aria-hidden="true"
                        className="size-4 text-[var(--tl-primary)]"
                      />
                      {selectedProject.location}
                    </dd>
                  </div>
                </dl>
                <p className="flex items-center gap-2 border-t border-[var(--tl-border)] bg-[var(--tl-success-soft)] px-4 py-3 text-xs font-bold sm:px-5">
                  <CheckCircle2
                    aria-hidden="true"
                    className="size-4 text-[var(--tl-success)]"
                  />
                  Project context confirmed
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.projects.map((project) => (
                  <li key={project.localId}>
                    <button
                      type="button"
                      className="group flex min-h-20 w-full items-center gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 text-left shadow-[var(--tl-shadow-sm)] transition-all hover:-translate-y-px hover:border-[var(--tl-primary)] hover:shadow-[var(--tl-shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tl-focus)]"
                      onClick={() => setSelectedProject(project)}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--tl-primary-soft)] text-[var(--tl-primary)] transition-colors group-hover:bg-[var(--tl-primary)] group-hover:text-[var(--tl-light-ink)]">
                        <FolderKanban aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-extrabold">
                          {project.name}
                        </span>
                        <span className="mt-1 block truncate text-sm font-semibold text-[var(--tl-ink-muted)]">
                          {project.clientName}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[var(--tl-ink-muted)]">
                          <MapPin aria-hidden="true" className="size-3.5" />
                          {project.code} · {project.location}
                        </span>
                      </span>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--tl-border)] text-[var(--tl-ink-muted)] transition-colors group-hover:border-[var(--tl-primary)] group-hover:text-[var(--tl-primary)]">
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedProject ? (
            <DecisionDialogFooter>
              <button
                type="button"
                className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-4 font-bold transition-colors hover:border-[var(--tl-primary)]"
                onClick={() => setSelectedProject(null)}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Back
              </button>
              <button
                type="button"
                className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tl-primary)] px-4 font-bold text-[var(--tl-light-ink)] shadow-[var(--tl-shadow-sm)] transition-colors hover:bg-[var(--tl-primary-deep)]"
                onClick={() =>
                  router.push(
                    newHoleMode === "client-plan"
                      ? `/start/new-hole?project=${encodeURIComponent(selectedProject.localId)}`
                      : `/projects/${encodeURIComponent(selectedProject.localId)}/holes/new`,
                  )
                }
              >
                Continue
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </DecisionDialogFooter>
          ) : null}
        </DecisionDialogContent>
      </Dialog>
    </div>
  );
}

function DecisionDialogContent({ children }: { children: ReactNode }) {
  return (
    <DialogPortal>
      <DialogOverlay className="target-lock bg-[var(--tl-overlay)] backdrop-blur-[3px]" />
      <DialogPrimitive.Content className="target-lock fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[22px] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-[var(--tl-ink)] shadow-[0_-18px_60px_rgb(13_25_42_/_24%)] outline-none sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--tl-radius-lg)] sm:shadow-[var(--tl-shadow-md)]">
        <span
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--tl-border-strong)] sm:hidden"
        />
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full border border-[var(--tl-border)] bg-[var(--tl-surface)] text-[var(--tl-ink-muted)] shadow-[var(--tl-shadow-sm)] transition-colors hover:border-[var(--tl-primary)] hover:text-[var(--tl-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tl-focus)] sm:right-4 sm:top-4">
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DecisionDialogHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  readonly icon: ReactNode;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="shrink-0 border-b border-[var(--tl-border)] bg-[linear-gradient(135deg,var(--tl-primary-soft),var(--tl-surface)_72%)] px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
      <div className="flex items-start gap-3 pr-11">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] text-[var(--tl-light-ink)] shadow-[var(--tl-shadow-sm)]">
          {icon}
        </span>
        <DialogHeader className="min-w-0 text-left">
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[var(--tl-primary)]">
            {eyebrow}
          </p>
          <DialogTitle className="mt-1 text-xl font-extrabold tracking-[-0.025em] sm:text-2xl">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-1.5 max-w-md text-sm leading-5 text-[var(--tl-ink-muted)]">
            {description}
          </DialogDescription>
        </DialogHeader>
      </div>
    </div>
  );
}

function DecisionDialogFooter({ children }: { readonly children: ReactNode }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[var(--tl-border)] bg-[var(--tl-surface)] px-5 py-4 shadow-[0_-10px_28px_rgb(13_25_42_/_7%)] sm:px-6">
      {children}
    </div>
  );
}

function HoleConfirmation({
  choice,
  role,
}: {
  choice: HoleChoice;
  role: OperatorRole;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--tl-radius-lg)] border-2 border-[var(--tl-primary)] bg-[var(--tl-surface)] shadow-[var(--tl-shadow-sm)]">
      <div className="flex items-start justify-between gap-3 bg-[var(--tl-primary-soft)] p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--tl-surface)] text-[var(--tl-primary)]">
            <Drill aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">
              {choice.hole.name}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--tl-ink-muted)]">
              {choice.project?.name ?? "Unknown project"}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.06em] text-[var(--tl-primary)]">
              Hole ID {choice.hole.localId}
            </p>
          </div>
        </div>
        <StatusPill tone={statusTone(choice.hole.status)}>
          {HOLE_STATUS_LABELS[choice.hole.status]}
        </StatusPill>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 text-sm sm:p-5">
        <div className="min-w-0">
          <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
            Client
          </dt>
          <dd className="mt-1 truncate font-bold">
            {choice.project?.clientName ?? "Unknown client"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
            Site / location
          </dt>
          <dd className="mt-1 truncate font-bold">
            {choice.project?.location ?? "Unknown site"}
          </dd>
        </div>
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
            Operator role
          </dt>
          <dd className="mt-1 font-bold">{roleLabel(role)}</dd>
        </div>
      </dl>
      <p className="flex items-center gap-2 border-t border-[var(--tl-border)] bg-[var(--tl-success-soft)] px-4 py-3 text-xs font-bold text-[var(--tl-ink)] sm:px-5">
        <CheckCircle2
          aria-hidden="true"
          className="size-4 text-[var(--tl-success)]"
        />
        Project, rig and role checked
      </p>
    </div>
  );
}
