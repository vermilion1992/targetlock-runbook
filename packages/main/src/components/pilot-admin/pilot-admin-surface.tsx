"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import {
  downloadPilotBackup,
  getBrowserStorageEstimate,
  validatePilotBackupDryRun,
  type PilotBackupDryRun,
} from "@/infrastructure/backup";
import {
  emptyOutboxSummary,
  createBrowserOutboxRepository,
  getBrowserCoreRecoveryCoordinator,
  getBrowserSyncCoordinator,
  requireClearPilotOutboxForContextExit,
  type CoreRestoreDryRun,
} from "@/infrastructure/sync";
import { useOperatorSession } from "@/components/session/operator-session-provider";
import type { CoreConflictDetails } from "@/server/pilot/core-types";

interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: "COMPANY_ADMIN" | "SUPERVISOR" | "DRILLER";
  readonly status: "ACTIVE" | "DISABLED" | "REVOKED";
  readonly mustChangePassword: boolean;
  readonly lastLoginAt: string | null;
}

interface AdminDevice {
  readonly id: string;
  readonly displayName: string;
  readonly status: "ACTIVE" | "DISABLED" | "REVOKED";
  readonly siteName: string | null;
  readonly projectRef: string | null;
  readonly rigRef: string | null;
  readonly lastSeenAt: string | null;
  readonly isPrimary: boolean;
}

interface AdminLease {
  readonly id: string;
  readonly resourceType: "HOLE" | "SHIFT";
  readonly resourceRef: string;
  readonly primaryDeviceId: string;
  readonly operatorUserId: string;
  readonly heartbeatAt: string;
  readonly expiresAt: string;
}

interface AdminOverview {
  readonly users: readonly AdminUser[];
  readonly devices: readonly AdminDevice[];
  readonly leases: readonly AdminLease[];
  readonly generatedAt: string;
}

interface Diagnostics {
  readonly appVersion: string;
  readonly expectedSchema: string;
  readonly currentSchema: string | null;
  readonly serverReady: boolean;
  readonly runtimeMode: "pilot";
  readonly sessionExpiresAt: string;
  readonly role: string;
  readonly deviceId: string | null;
  readonly deviceLastSeenAt: string | null;
  readonly journalSemantics: "AUTHORITATIVE_CORE_WITH_JOURNAL_ONLY_PERIPHERALS";
  readonly domainMaterialization: true;
  readonly blobUpload: false;
}

interface ConflictView {
  readonly operationId: string;
  readonly operationType: string;
  readonly localExpectedVersion: number | null;
  readonly reasonCode: string | null;
  readonly details: CoreConflictDetails | null;
}

const noSubscribe = () => () => {};
const emptySummary = emptyOutboxSummary();
const unavailableSummary = {
  ...emptyOutboxSummary("unavailable"),
  incomplete: 1,
  storageErrors: 1,
  unsynced: 1,
};

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Request failed (${response.status}).`);
  }
  return body;
}

function readableBytes(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 ** 2).toFixed(1)} MiB`;
}

export function PilotAdminSurface() {
  const router = useRouter();
  const { pilot, refresh } = useOperatorSession();
  const syncCoordinator = getBrowserSyncCoordinator();
  const recoveryCoordinator = getBrowserCoreRecoveryCoordinator();
  const syncSummary = useSyncExternalStore(
    syncCoordinator?.subscribe ?? noSubscribe,
    syncCoordinator?.getSnapshot ?? (() => unavailableSummary),
    () => emptySummary,
  );
  const recoverySummary = useSyncExternalStore(
    recoveryCoordinator?.subscribe ?? noSubscribe,
    recoveryCoordinator?.getSnapshot ?? (() => ({
      status: "unavailable" as const,
      cursor: null,
      lastPulledAt: null,
      holeCount: 0,
      aggregateRevisions: {},
      message: "Authoritative recovery is unavailable.",
    })),
    () => ({
      status: "unknown" as const,
      cursor: null,
      lastPulledAt: null,
      holeCount: 0,
      aggregateRevisions: {},
      message: null,
    }),
  );
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [storage, setStorage] = useState<{
    usage: number | null;
    quota: number | null;
    percentUsed: number | null;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backupDryRun, setBackupDryRun] =
    useState<PilotBackupDryRun | null>(null);
  const [restoreDryRun, setRestoreDryRun] =
    useState<CoreRestoreDryRun | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [conflicts, setConflicts] = useState<readonly ConflictView[]>([]);

  async function load() {
    try {
      const [overviewBody, diagnosticsBody, storageEstimate] =
        await Promise.all([
          requestJson<{ overview: AdminOverview }>(
            "/api/pilot/admin/overview",
          ),
          requestJson<{ diagnostics: Diagnostics }>(
            "/api/pilot/diagnostics",
          ),
          getBrowserStorageEstimate(),
        ]);
      setOverview(overviewBody.overview);
      setDiagnostics(diagnosticsBody.diagnostics);
      setStorage(storageEstimate);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Pilot administration is unavailable.",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!pilot || syncSummary.conflict === 0) return;
    let cancelled = false;
    void (async () => {
      const repository = createBrowserOutboxRepository();
      if (!repository) return;
      const operations = (await repository.listAll()).filter(
        (operation) =>
          operation.state === "conflict" &&
          operation.envelope.organisationId === pilot.organisationId,
      );
      const views = await Promise.all(
        operations.map(async (operation): Promise<ConflictView> => {
          try {
            const body = await requestJson<{ conflict: CoreConflictDetails }>(
              `/api/pilot/core/conflicts/${operation.operationId}`,
            );
            return {
              operationId: operation.operationId,
              operationType: operation.envelope.operationType,
              localExpectedVersion: operation.envelope.expectedVersion,
              reasonCode: operation.reasonCode,
              details: body.conflict,
            };
          } catch {
            return {
              operationId: operation.operationId,
              operationType: operation.envelope.operationType,
              localExpectedVersion: operation.envelope.expectedVersion,
              reasonCode: operation.reasonCode,
              details: null,
            };
          }
        }),
      );
      if (!cancelled) setConflicts(views);
    })();
    return () => {
      cancelled = true;
    };
  }, [pilot, syncSummary.conflict]);

  async function run(action: () => Promise<string | void>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const nextMessage = await action();
      if (nextMessage) setMessage(nextMessage);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!pilot) {
    return (
      <section role="alert" className="rounded-lg border p-5">
        Pilot administration requires a verified server session.
      </section>
    );
  }

  return (
    <div className="space-y-6" data-testid="pilot-admin">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--tl-primary)]">
          Controlled shadow pilot
        </p>
        <h1 className="mt-1 text-3xl font-extrabold">Pilot administration</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--tl-ink-muted)]">
          Accounts, devices, leases and the core drilling workflow are
          server-backed. Field writes still commit locally first. Core project,
          hole, BHA, shift, run, rod and handover records can be restored to an
          authorised replacement tablet; peripheral records and media are not
          yet fully recoverable.
        </p>
      </header>

      {message ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md bg-[var(--tl-danger-soft)] p-3 text-sm font-semibold text-[var(--tl-danger)]">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-[var(--tl-border)] bg-[var(--tl-surface)] p-5">
        <h2 className="text-xl font-extrabold">Users</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="text-xs uppercase text-[var(--tl-ink-muted)]">
              <tr>
                <th className="pb-2">Name</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Password</th>
                <th className="pb-2">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {overview?.users.map((user) => (
                <tr key={user.id} className="border-t border-[var(--tl-border)]">
                  <td className="py-3">
                    <strong className="block">{user.displayName}</strong>
                    <span className="text-xs text-[var(--tl-ink-muted)]">{user.email}</span>
                  </td>
                  <td>{user.role.replace("_", " ")}</td>
                  <td>{user.status}</td>
                  <td>{user.mustChangePassword ? "Change required" : "Current"}</td>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pilot.serverRole === "COMPANY_ADMIN" ? (
          <ProvisionUserForm busy={busy} onSubmit={(input) => run(async () => {
            await requestJson("/api/pilot/users/provision", {
              method: "POST",
              body: JSON.stringify(input),
            });
            return "User provisioned. Deliver the temporary password out-of-band; TargetLock will not show it again.";
          })} />
        ) : (
          <p className="mt-4 text-sm text-[var(--tl-ink-muted)]">
            Supervisors can view user status. Company admins provision or disable accounts.
          </p>
        )}
        {pilot.serverRole === "COMPANY_ADMIN" && overview ? (
          <UserStatusForm users={overview.users} busy={busy} onSubmit={(input) => run(async () => {
            await requestJson("/api/pilot/users/status", {
              method: "POST",
              body: JSON.stringify(input),
            });
            return "User status updated; prior sessions were invalidated.";
          })} />
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--tl-border)] bg-[var(--tl-surface)] p-5">
        <h2 className="text-xl font-extrabold">Devices and rig assignment</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {overview?.devices.map((device) => (
            <li key={device.id} className="rounded-md border border-[var(--tl-border)] p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <strong>{device.displayName}</strong>
                <span>{device.status}</span>
              </div>
              <p className="mt-2 text-[var(--tl-ink-muted)]">
                {device.siteName ?? "No site"} · {device.projectRef ?? "No project"} · {device.rigRef ?? "No rig"}
              </p>
              <p className="mt-1 text-xs text-[var(--tl-ink-muted)]">
                Last seen {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "never"}
              </p>
            </li>
          ))}
        </ul>
        <RegisterDeviceForm busy={busy} onSubmit={(input) => run(async () => {
          await requestJson("/api/pilot/devices/register", {
            method: "POST",
            body: JSON.stringify(input),
          });
          refresh();
          return "This browser is now registered. Its HttpOnly device cookie persists across normal operator logout.";
        })} />
        {overview ? (
          <AssignDeviceForm devices={overview.devices} busy={busy} onAssign={(input) => run(async () => {
            if (input.deviceId === pilot.device?.id) {
              await requireClearPilotOutboxForContextExit();
            }
            await requestJson("/api/pilot/devices/assign", {
              method: "POST",
              body: JSON.stringify(input),
            });
            refresh();
            return "Device assignment updated.";
          })} onRevoke={(input) => run(async () => {
            if (input.deviceId === pilot.device?.id) {
              await requireClearPilotOutboxForContextExit();
            }
            await requestJson("/api/pilot/devices/status", {
              method: "POST",
              body: JSON.stringify({ ...input, status: "REVOKED" }),
            });
            refresh();
            return "Device revoked.";
          })} />
        ) : null}
        {pilot.device ? (
          <RemoveCurrentDeviceForm busy={busy} deviceName={pilot.device.displayName} onSubmit={(reason) => run(async () => {
            await requireClearPilotOutboxForContextExit();
            await requestJson("/api/pilot/devices/remove-current", {
              method: "POST",
              body: JSON.stringify({ reason }),
            });
            refresh();
            return "This browser was explicitly removed as a registered device. Your operator session remains signed in.";
          })} />
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--tl-border)] bg-[var(--tl-surface)] p-5">
        <h2 className="text-xl font-extrabold">Writer leases</h2>
        {overview?.leases.length ? (
          <ul className="mt-4 space-y-3">
            {overview.leases.map((lease) => (
              <li key={lease.id} className="rounded-md border border-[var(--tl-border)] p-4 text-sm">
                <strong>{lease.resourceType} · {lease.resourceRef}</strong>
                <p className="mt-1 text-[var(--tl-ink-muted)]">
                  Device {lease.primaryDeviceId} · heartbeat {new Date(lease.heartbeatAt).toLocaleString()}
                </p>
                <LeaseActionForm busy={busy} lease={lease} onTakeover={(reason) => run(async () => {
                  await requestJson("/api/pilot/leases/takeover", {
                    method: "POST",
                    body: JSON.stringify({ leaseId: lease.id, reason, ttlSeconds: 300 }),
                  });
                  return "Lease taken over with an audited reason.";
                })} onRelease={(reason) => run(async () => {
                  await requestJson("/api/pilot/leases/supervisor-release", {
                    method: "POST",
                    body: JSON.stringify({ leaseId: lease.id, reason }),
                  });
                  return "Stale lease released with an audited reason.";
                })} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--tl-ink-muted)]">No active writer leases.</p>
        )}
      </section>

      <section className="rounded-lg border border-[var(--tl-border)] bg-[var(--tl-surface)] p-5">
        <h2 className="text-xl font-extrabold">Password</h2>
        {pilot.mustChangePassword ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-amber-700">
            This account is using a temporary password. Change it before field work.
          </p>
        ) : null}
        <PasswordChangeForm busy={busy} onSubmit={(input) => run(async () => {
          await requestJson("/api/pilot/auth/change-password", {
            method: "POST",
            body: JSON.stringify(input),
          });
          router.replace("/sign-in?reason=session-expired");
          return "Password changed.";
        })} />
      </section>

      <section className="rounded-lg border border-[var(--tl-border)] bg-[var(--tl-surface)] p-5">
        <h2 className="text-xl font-extrabold">Support and diagnostics</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Diagnostic label="App" value={diagnostics?.appVersion ?? "Checking…"} />
          <Diagnostic label="Runtime" value={diagnostics?.runtimeMode ?? "Checking…"} />
          <Diagnostic label="Schema" value={diagnostics?.currentSchema ?? "Unavailable"} />
          <Diagnostic label="Readiness" value={diagnostics?.serverReady ? "Ready" : "Not ready"} />
          <Diagnostic label="Session expires" value={diagnostics ? new Date(diagnostics.sessionExpiresAt).toLocaleString() : "Checking…"} />
          <Diagnostic label="Device" value={pilot.device?.displayName ?? "Not registered"} />
          <Diagnostic label="Journal storage" value={syncSummary.availability} />
          <Diagnostic label="Unsynced operations" value={String(syncSummary.unsynced)} />
          <Diagnostic label="Quarantined operations" value={String(syncSummary.quarantined)} />
          <Diagnostic label="Last accepted" value={syncSummary.lastAcceptedAt ? new Date(syncSummary.lastAcceptedAt).toLocaleString() : "None"} />
          <Diagnostic label="Core authority" value={recoverySummary.status} />
          <Diagnostic label="Pull cursor" value={recoverySummary.cursor ?? "Not pulled"} />
          <Diagnostic label="Last server pull" value={recoverySummary.lastPulledAt ? new Date(recoverySummary.lastPulledAt).toLocaleString() : "None"} />
          <Diagnostic label="Browser storage" value={`${readableBytes(storage?.usage ?? null)} / ${readableBytes(storage?.quota ?? null)}${storage?.percentUsed !== null && storage?.percentUsed !== undefined ? ` (${storage.percentUsed}%)` : ""}`} />
        </dl>
        {storage?.percentUsed !== null && storage?.percentUsed !== undefined && storage.percentUsed >= 80 ? (
          <p role="alert" className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            Browser storage is {storage.percentUsed}% full. Export a backup and free space before the next shift.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="min-h-11 rounded-md border px-4 font-bold" onClick={() => void syncCoordinator?.flush(true)}>
            Push then pull core state
          </button>
          <button type="button" className="min-h-11 rounded-md border px-4 font-bold" onClick={() => void run(async () => {
            if (!recoveryCoordinator) throw new Error("Authoritative recovery is unavailable.");
            const preview = await recoveryCoordinator.inspectRestore();
            setRestoreDryRun(preview);
            return preview.canRestore
              ? "Restore preview ready. Review the replacement count and confirm below."
              : "Restore is blocked by pending local operations.";
          })}>
            Preview server restore
          </button>
          <button type="button" className="min-h-11 rounded-md border px-4 font-bold" onClick={() => void run(async () => {
            const checksum = await downloadPilotBackup({
              organisationId: pilot.organisationId,
              operatorId: pilot.operatorId,
            });
            return `Metadata backup exported. SHA-256 ${checksum}. Media blobs are not included.`;
          })}>
            Export pilot backup
          </button>
          <label className="flex min-h-11 cursor-pointer items-center rounded-md border px-4 font-bold">
            Validate backup (dry-run)
            <input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              void validatePilotBackupDryRun(file, pilot.organisationId).then(setBackupDryRun);
            }} />
          </label>
        </div>
        {backupDryRun ? (
          <p role="status" className="mt-3 text-sm font-semibold">
            {backupDryRun.message} {backupDryRun.localRecordCount} local records, {backupDryRun.operationCount} operations, {backupDryRun.mediaManifestCount} media manifest entries.
          </p>
        ) : null}
        {restoreDryRun ? (
          <div className="mt-4 rounded-md border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
            <h3 className="font-extrabold">Server restore dry-run</h3>
            <p className="mt-1">
              {restoreDryRun.serverRecordCount} authoritative records across{" "}
              {restoreDryRun.snapshots.length} hole
              {restoreDryRun.snapshots.length === 1 ? "" : "s"};{" "}
              {restoreDryRun.localRecordCount} local storage areas would be
              replaced.
            </p>
            <p className="mt-1 font-semibold">
              {restoreDryRun.pendingOperationCount > 0
                ? `${restoreDryRun.pendingOperationCount} pending local operation(s) block restore. Push or export before any discard decision.`
                : "No pending local operations were found. Export a backup before replacing established local state."}
            </p>
            {restoreDryRun.canRestore ? (
              <div className="mt-3">
                <Input
                  name="restoreReason"
                  label="Required restore reason"
                  minLength={10}
                  value={restoreReason}
                  onChange={(event) => setRestoreReason(event.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || restoreReason.trim().length < 10}
                  className="mt-3 min-h-11 rounded-md bg-amber-950 px-4 font-bold text-white disabled:opacity-50"
                  onClick={() => void run(async () => {
                    await recoveryCoordinator?.restore(restoreDryRun, {
                      confirmed: true,
                      reason: restoreReason,
                    });
                    setRestoreDryRun(null);
                    setRestoreReason("");
                    return "This device was restored from authoritative server state. Media blobs were not restored.";
                  })}
                >
                  Confirm restore from server
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {syncSummary.conflict > 0 ? (
          <div className="mt-4 rounded-md border border-red-400 bg-red-50 p-4 text-sm text-red-950">
            <h3 className="font-extrabold">Authoritative conflict review</h3>
            <p className="mt-1">
              Keep this device read-only. Export the pilot backup before a
              supervisor decides whether to correct, supersede or retain the
              pending operation. TargetLock will not auto-merge or discard it.
            </p>
            <ul className="mt-3 space-y-3">
              {conflicts.map((conflict) => (
                <li key={conflict.operationId} className="rounded border border-red-300 bg-white p-3">
                  <strong>{conflict.operationType}</strong>
                  <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                    <Diagnostic label="Operation" value={conflict.operationId} />
                    <Diagnostic label="Reason" value={conflict.details?.reasonCode ?? conflict.reasonCode ?? "Conflict"} />
                    <Diagnostic label="Pending expected revision" value={String(conflict.localExpectedVersion ?? "Unversioned")} />
                    <Diagnostic label="Current server revision" value={String(conflict.details?.currentVersion ?? "Unavailable")} />
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-4 text-xs text-[var(--tl-ink-muted)]">
          Backup files contain operational metadata, outbox records and a media
          manifest. They do not contain recoverable photo/report blobs; keep the
          dedicated tablet and normal reports until blob backup is implemented.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold">
          <Link href="/pilot-terms">Pilot terms, privacy and data ownership</Link>
          <Link href="/pilot-support">Support and incident checklist</Link>
        </div>
      </section>
    </div>
  );
}

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-[var(--tl-ink-muted)]">{label}</dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}

function ProvisionUserForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (input: Record<string, string>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      displayName: String(data.get("displayName") ?? ""),
      email: String(data.get("email") ?? ""),
      role: String(data.get("role") ?? ""),
      temporaryPassword: String(data.get("temporaryPassword") ?? ""),
    });
  }
  return (
    <form className="mt-5 grid gap-3 rounded-md bg-[var(--tl-surface-raised)] p-4 sm:grid-cols-2" onSubmit={submit}>
      <h3 className="font-extrabold sm:col-span-2">Provision user</h3>
      <Input name="displayName" label="Full name" required />
      <Input name="email" label="Email" type="email" required />
      <Select name="role" label="Server role" options={["DRILLER", "SUPERVISOR", "COMPANY_ADMIN"]} />
      <Input name="temporaryPassword" label="One-time temporary password" type="password" minLength={12} required />
      <p className="text-xs text-[var(--tl-ink-muted)] sm:col-span-2">
        The password is hashed immediately and is never returned. The user must change it after sign-in.
      </p>
      <Submit busy={busy} label="Provision user" />
    </form>
  );
}

function UserStatusForm({ users, busy, onSubmit }: { users: readonly AdminUser[]; busy: boolean; onSubmit: (input: Record<string, string>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({ userId: String(data.get("userId")), status: String(data.get("status")), reason: String(data.get("reason")) });
  }
  return (
    <form className="mt-4 grid gap-3 rounded-md bg-[var(--tl-surface-raised)] p-4 sm:grid-cols-2" onSubmit={submit}>
      <h3 className="font-extrabold sm:col-span-2">Change user status</h3>
      <label className="text-sm font-bold">User<select name="userId" className="mt-1 min-h-11 w-full rounded-md border bg-[var(--tl-surface)] px-3">{users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.role}</option>)}</select></label>
      <Select name="status" label="Status" options={["ACTIVE", "DISABLED", "REVOKED"]} />
      <div className="sm:col-span-2"><Input name="reason" label="Required reason" minLength={10} required /></div>
      <Submit busy={busy} label="Update status" />
    </form>
  );
}

function RegisterDeviceForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: Record<string, string | null>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const optional = (name: string) => String(data.get(name) ?? "").trim() || null;
    onSubmit({ displayName: String(data.get("displayName")), siteName: optional("siteName"), projectRef: optional("projectRef"), rigRef: optional("rigRef") });
  }
  return (
    <form className="mt-5 grid gap-3 rounded-md bg-[var(--tl-surface-raised)] p-4 sm:grid-cols-2" onSubmit={submit}>
      <h3 className="font-extrabold sm:col-span-2">Register this browser</h3>
      <Input name="displayName" label="Device name" required />
      <Input name="siteName" label="Site name" />
      <Input name="projectRef" label="Project local ID" />
      <Input name="rigRef" label="Rig local ID" />
      <Submit busy={busy} label="Register device" />
    </form>
  );
}

function AssignDeviceForm({ devices, busy, onAssign, onRevoke }: { devices: readonly AdminDevice[]; busy: boolean; onAssign: (input: Record<string, string | null>) => void; onRevoke: (input: { deviceId: string; reason: string }) => void }) {
  function values(form: HTMLFormElement) {
    const data = new FormData(form);
    const optional = (name: string) => String(data.get(name) ?? "").trim() || null;
    return { deviceId: String(data.get("deviceId")), siteName: optional("siteName"), projectRef: optional("projectRef"), rigRef: optional("rigRef"), reason: String(data.get("reason")) };
  }
  return (
    <form className="mt-4 grid gap-3 rounded-md bg-[var(--tl-surface-raised)] p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onAssign(values(event.currentTarget)); }}>
      <h3 className="font-extrabold sm:col-span-2">Assign or revoke device</h3>
      <label className="text-sm font-bold">Device<select name="deviceId" className="mt-1 min-h-11 w-full rounded-md border bg-[var(--tl-surface)] px-3">{devices.map((device) => <option key={device.id} value={device.id}>{device.displayName} · {device.status}</option>)}</select></label>
      <Input name="siteName" label="Site name" />
      <Input name="projectRef" label="Project local ID" />
      <Input name="rigRef" label="Rig local ID" />
      <div className="sm:col-span-2"><Input name="reason" label="Required reason" minLength={10} required /></div>
      <div className="flex gap-3 sm:col-span-2">
        <Submit busy={busy} label="Save assignment" />
        <button disabled={busy} type="button" className="min-h-11 rounded-md border border-[var(--tl-danger)] px-4 font-bold text-[var(--tl-danger)]" onClick={(event) => {
          const input = values(event.currentTarget.form!);
          onRevoke({ deviceId: input.deviceId, reason: input.reason });
        }}>Revoke device</button>
      </div>
    </form>
  );
}

function RemoveCurrentDeviceForm({ busy, deviceName, onSubmit }: { busy: boolean; deviceName: string; onSubmit: (reason: string) => void }) {
  return (
    <form className="mt-4 rounded-md border border-[var(--tl-danger)] p-4" onSubmit={(event) => { event.preventDefault(); onSubmit(String(new FormData(event.currentTarget).get("reason"))); }}>
      <h3 className="font-extrabold">Remove/revoke this device</h3>
      <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">Normal operator logout keeps {deviceName} registered. Use this only for retirement, loss, reassignment or suspected compromise.</p>
      <div className="mt-3"><Input name="reason" label="Required removal reason" minLength={10} required /></div>
      <button disabled={busy} className="mt-3 min-h-11 rounded-md bg-[var(--tl-danger)] px-4 font-bold text-white">Remove this device</button>
    </form>
  );
}

function LeaseActionForm({ busy, lease, onTakeover, onRelease }: { busy: boolean; lease: AdminLease; onTakeover: (reason: string) => void; onRelease: (reason: string) => void }) {
  return (
    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); onTakeover(String(new FormData(event.currentTarget).get("reason"))); }}>
      <div className="min-w-64 flex-1"><Input name="reason" label="Required takeover/release reason" minLength={10} required /></div>
      <button disabled={busy} className="min-h-11 rounded-md border px-4 font-bold">Take over</button>
      <button disabled={busy} type="button" className="min-h-11 rounded-md border px-4 font-bold" onClick={(event) => {
        const form = event.currentTarget.form!;
        if (!form.reportValidity()) return;
        onRelease(String(new FormData(form).get("reason")));
      }}>Release stale lease</button>
      <input type="hidden" value={lease.id} readOnly />
    </form>
  );
}

function PasswordChangeForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: Record<string, string>) => void }) {
  return (
    <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSubmit({ currentPassword: String(data.get("currentPassword")), newPassword: String(data.get("newPassword")) });
    }}>
      <Input name="currentPassword" label="Current password" type="password" minLength={10} required />
      <Input name="newPassword" label="New password" type="password" minLength={12} required />
      <p className="text-xs text-[var(--tl-ink-muted)] sm:col-span-2">Changing the password revokes every prior session, including this one. The dedicated device registration remains until explicitly removed.</p>
      <Submit busy={busy} label="Change password and sign out" />
    </form>
  );
}

function Input({ label, ...props }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block text-sm font-bold">{label}<input {...props} className="mt-1 min-h-11 w-full rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 font-normal" /></label>;
}

function Select({ name, label, options }: { name: string; label: string; options: readonly string[] }) {
  return <label className="block text-sm font-bold">{label}<select name={name} className="mt-1 min-h-11 w-full rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 font-normal">{options.map((option) => <option key={option} value={option}>{option.replace("_", " ")}</option>)}</select></label>;
}

function Submit({ busy, label }: { busy: boolean; label: string }) {
  return <button disabled={busy} className="min-h-11 rounded-md bg-[var(--tl-primary)] px-4 font-bold text-white disabled:opacity-60 sm:col-span-2">{busy ? "Working…" : label}</button>;
}
