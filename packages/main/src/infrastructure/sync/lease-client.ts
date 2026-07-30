import type { LeaseEvidence } from "./domain-operation";
import { getPilotBrowserRuntimeContext } from "./pilot-runtime";

export interface ClientWorkLease {
  readonly id: string;
  readonly primaryDeviceId: string;
  readonly resourceRef: string;
  readonly status: "ACTIVE" | "RELEASED" | "EXPIRED" | "TAKEN_OVER";
  readonly heartbeatAt: string;
  readonly expiresAt: string;
  readonly version: number;
  readonly offlineGraceIssuedAt: string;
  readonly offlineGraceExpiresAt: string;
  readonly completionGraceExpiresAt: string;
}

export type ClientLeaseState =
  | {
      readonly kind: "INACTIVE" | "DEVICE_REQUIRED";
      readonly holeRef: string | null;
      readonly message: string;
      readonly lease: null;
    }
  | {
      readonly kind: "CHECKING" | "AVAILABLE";
      readonly holeRef: string;
      readonly message: string;
      readonly lease: null;
    }
  | {
      readonly kind:
        | "PRIMARY_WRITER"
        | "READ_ONLY"
        | "OFFLINE_GRACE"
        | "CONFLICT";
      readonly holeRef: string;
      readonly message: string;
      readonly lease: ClientWorkLease;
      readonly graceExpiresAt?: string;
    };

export class PilotMutationBlockedError extends Error {
  constructor(
    readonly code:
      | "DEVICE_REQUIRED"
      | "LEASE_READ_ONLY"
      | "OFFLINE_GRACE_EXPIRED"
      | "LEASE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "PilotMutationBlockedError";
  }
}

interface LeaseApiResponse {
  readonly state?: "AVAILABLE" | "OWNED_BY_THIS_DEVICE" | "READ_ONLY";
  readonly lease?: ClientWorkLease | null;
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly lease?: ClientWorkLease;
  };
}

function cacheKey(
  organisationId: string,
  deviceId: string,
  holeRef: string,
): string {
  return `targetlock:pilot:lease-evidence:${organisationId}:${deviceId}:${holeRef}`;
}

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ readonly response: Response; readonly body: T }> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T;
  return { response, body };
}

export class PilotLeaseCoordinator {
  private state: ClientLeaseState = {
    kind: "INACTIVE",
    holeRef: null,
    message: "No active hole lease.",
    lease: null,
  };
  private readonly listeners = new Set<() => void>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  getSnapshot = (): ClientLeaseState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(state: ClientLeaseState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  async activateHole(
    holeRef: string,
    projectRef: string | null = null,
    graceMethod = "record",
  ): Promise<void> {
    if (
      this.state.kind === "PRIMARY_WRITER" &&
      this.state.holeRef !== holeRef
    ) {
      await this.releaseActive().catch(() => undefined);
    }
    const runtime = getPilotBrowserRuntimeContext();
    if (!runtime) {
      this.stopHeartbeat();
      this.update({
        kind: "INACTIVE",
        holeRef: null,
        message: "Lease control is inactive outside pilot mode.",
        lease: null,
      });
      return;
    }
    if (!runtime.device) {
      this.stopHeartbeat();
      this.update({
        kind: "DEVICE_REQUIRED",
        holeRef,
        message: "Register this tablet before changing field records.",
        lease: null,
      });
      return;
    }
    this.update({
      kind: "CHECKING",
      holeRef,
      message: "Checking the primary writer lease.",
      lease: null,
    });
    await this.refreshOrAcquire(holeRef, projectRef, graceMethod);
    this.startHeartbeat();
  }

  deactivate(): void {
    this.stopHeartbeat();
    this.update({
      kind: "INACTIVE",
      holeRef: null,
      message: "No active hole lease.",
      lease: null,
    });
  }

  async ensureWritable(
    holeRef: string | null,
    method: string,
    projectRef: string | null,
  ): Promise<LeaseEvidence> {
    if (holeRef === null) {
      return {
        state: "NOT_REQUIRED",
        leaseId: null,
        leaseVersion: null,
        lastVerifiedAt: null,
        graceExpiresAt: null,
      };
    }
    const runtime = getPilotBrowserRuntimeContext();
    if (!runtime?.device) {
      throw new PilotMutationBlockedError(
        "DEVICE_REQUIRED",
        "This field change requires an active registered rig tablet.",
      );
    }
    if (online()) {
      if (
        this.state.holeRef !== holeRef ||
        this.state.kind !== "PRIMARY_WRITER"
      ) {
        await this.activateHole(holeRef, projectRef, method);
      }
      if (this.state.kind === "PRIMARY_WRITER" && this.state.holeRef === holeRef) {
        return this.evidenceFor(this.state.lease, "PRIMARY_WRITER", null);
      }
      if (this.state.kind === "OFFLINE_GRACE" && this.state.holeRef === holeRef) {
        return this.evidenceFor(
          this.state.lease,
          "OFFLINE_GRACE",
          this.state.graceExpiresAt ?? null,
        );
      }
      throw new PilotMutationBlockedError(
        "LEASE_READ_ONLY",
        this.state.message,
      );
    }

    const cached = this.readCachedLease(
      runtime.organisationId,
      runtime.device.id,
      holeRef,
    );
    if (!cached) {
      throw new PilotMutationBlockedError(
        "LEASE_UNAVAILABLE",
        "Offline writing is unavailable because this tablet has no recent primary-writer lease for this hole.",
      );
    }
    return this.activateCachedGrace(holeRef, method, cached);
  }

  async releaseActive(): Promise<void> {
    if (this.state.kind !== "PRIMARY_WRITER" || !online()) return;
    const lease = this.state.lease;
    const { response } = await api<LeaseApiResponse>(
      "/api/pilot/leases/release",
      {
        method: "POST",
        body: JSON.stringify({ leaseId: lease.id }),
      },
    );
    if (response.ok) {
      this.update({
        kind: "AVAILABLE",
        holeRef: this.state.holeRef,
        message: "The primary writer lease was released.",
        lease: null,
      });
    }
  }

  private async refreshOrAcquire(
    holeRef: string,
    projectRef: string | null,
    graceMethod: string,
  ): Promise<void> {
    const runtime = getPilotBrowserRuntimeContext();
    if (!runtime?.device) return;
    if (!online()) {
      const cached = this.readCachedLease(
        runtime.organisationId,
        runtime.device.id,
        holeRef,
      );
      if (!cached) {
        throw new PilotMutationBlockedError(
          "LEASE_UNAVAILABLE",
          "Offline writing is unavailable because this tablet has no recent primary-writer lease for this hole.",
        );
      }
      this.activateCachedGrace(holeRef, graceMethod, cached);
      return;
    }
    const search = new URLSearchParams({
      resourceType: "HOLE",
      resourceRef: holeRef,
      holeRef,
    });
    if (projectRef) search.set("projectRef", projectRef);
    try {
      const status = await api<LeaseApiResponse>(
        `/api/pilot/leases/status?${search.toString()}`,
      );
      if (status.response.status === 401) {
        window.dispatchEvent(new Event("targetlock:pilot-session-expired"));
        throw new PilotMutationBlockedError(
          "LEASE_UNAVAILABLE",
          "The pilot session expired. Sign in again before changing records.",
        );
      }
      if (!status.response.ok) {
        throw new Error(
          status.body.error?.message ?? "Lease status is unavailable.",
        );
      }
      if (status.body.state === "READ_ONLY" && status.body.lease) {
        this.update({
          kind: "READ_ONLY",
          holeRef,
          lease: status.body.lease,
          message: "Another registered tablet is the primary writer.",
        });
        return;
      }
      if (
        status.body.state === "OWNED_BY_THIS_DEVICE" &&
        status.body.lease
      ) {
        this.acceptOwnedLease(holeRef, status.body.lease);
        return;
      }
      const acquired = await api<LeaseApiResponse>(
        "/api/pilot/leases/acquire",
        {
          method: "POST",
          body: JSON.stringify({
            resourceType: "HOLE",
            resourceRef: holeRef,
            projectRef,
            holeRef,
            ttlSeconds: 300,
          }),
        },
      );
      if (acquired.response.ok && acquired.body.lease) {
        this.acceptOwnedLease(holeRef, acquired.body.lease);
        return;
      }
      if (
        acquired.response.status === 409 &&
        acquired.body.error?.lease
      ) {
        this.update({
          kind: "READ_ONLY",
          holeRef,
          lease: acquired.body.error.lease,
          message: "Another registered tablet is the primary writer.",
        });
        return;
      }
      throw new Error(
        acquired.body.error?.message ?? "The work lease could not be acquired.",
      );
    } catch (error) {
      if (error instanceof PilotMutationBlockedError) throw error;
      const cached = this.readCachedLease(
        runtime.organisationId,
        runtime.device.id,
        holeRef,
      );
      if (cached) {
        this.activateCachedGrace(holeRef, graceMethod, cached);
        return;
      }
      this.update({
        kind: "CONFLICT",
        holeRef,
        lease: {
          id: crypto.randomUUID(),
          primaryDeviceId: runtime.device.id,
          resourceRef: holeRef,
          status: "EXPIRED",
          heartbeatAt: new Date(0).toISOString(),
          expiresAt: new Date(0).toISOString(),
          offlineGraceIssuedAt: new Date(0).toISOString(),
          offlineGraceExpiresAt: new Date(0).toISOString(),
          completionGraceExpiresAt: new Date(0).toISOString(),
          version: 1,
        },
        message:
          error instanceof Error
            ? error.message
            : "The work lease is unavailable.",
      });
    }
  }

  private acceptOwnedLease(holeRef: string, lease: ClientWorkLease): void {
    const runtime = getPilotBrowserRuntimeContext();
    if (!runtime?.device) return;
    const verifiedAt = new Date().toISOString();
    try {
      localStorage.setItem(
        cacheKey(runtime.organisationId, runtime.device.id, holeRef),
        JSON.stringify({ lease, verifiedAt }),
      );
    } catch {
      // In-memory ownership remains usable; diagnostics reports storage pressure.
    }
    this.update({
      kind: "PRIMARY_WRITER",
      holeRef,
      lease,
      message: "This tablet is the primary writer.",
    });
  }

  private activateCachedGrace(
    holeRef: string,
    method: string,
    cached: {
      readonly lease: ClientWorkLease;
      readonly verifiedAt: string;
    },
  ): LeaseEvidence {
    const isCompletion = /complete|close|handover|finalize/i.test(method);
    const graceExpiresAt = isCompletion
      ? cached.lease.completionGraceExpiresAt
      : cached.lease.offlineGraceExpiresAt;
    if (Date.now() > Date.parse(graceExpiresAt)) {
      throw new PilotMutationBlockedError(
        "OFFLINE_GRACE_EXPIRED",
        isCompletion
          ? "The bounded offline completion window has expired. Reconnect or contact a supervisor before changing this record."
          : "The 30-minute offline write grace has expired. Reconnect before recording more work.",
      );
    }
    this.update({
      kind: "OFFLINE_GRACE",
      holeRef,
      lease: cached.lease,
      graceExpiresAt,
      message: isCompletion
        ? "Offline completion grace is active and will be journaled for review."
        : "Offline grace is active. Reconnect within 30 minutes.",
    });
    return this.evidenceFor(cached.lease, "OFFLINE_GRACE", graceExpiresAt);
  }

  private readCachedLease(
    organisationId: string,
    deviceId: string,
    holeRef: string,
  ): { readonly lease: ClientWorkLease; readonly verifiedAt: string } | null {
    try {
      const raw = localStorage.getItem(
        cacheKey(organisationId, deviceId, holeRef),
      );
      if (!raw) return null;
      const value = JSON.parse(raw) as {
        lease?: ClientWorkLease;
        verifiedAt?: string;
      };
      return value.lease &&
        value.verifiedAt &&
        value.lease.primaryDeviceId === deviceId &&
        value.lease.resourceRef === holeRef
        ? { lease: value.lease, verifiedAt: value.verifiedAt }
        : null;
    } catch {
      return null;
    }
  }

  private evidenceFor(
    lease: ClientWorkLease,
    state: "PRIMARY_WRITER" | "OFFLINE_GRACE",
    graceExpiresAt: string | null,
  ): LeaseEvidence {
    const runtime = getPilotBrowserRuntimeContext();
    const cached = runtime?.device
      ? this.readCachedLease(
          runtime.organisationId,
          runtime.device.id,
          lease.resourceRef,
        )
      : null;
    return {
      state,
      leaseId: lease.id,
      leaseVersion: lease.version,
      lastVerifiedAt:
        cached?.lease.offlineGraceIssuedAt ?? lease.offlineGraceIssuedAt,
      graceExpiresAt,
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      void this.heartbeat();
    }, 60_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private async heartbeat(): Promise<void> {
    if (this.state.kind !== "PRIMARY_WRITER" || !online()) return;
    const holeRef = this.state.holeRef;
    try {
      const heartbeat = await api<LeaseApiResponse>(
        "/api/pilot/leases/heartbeat",
        {
          method: "POST",
          body: JSON.stringify({
            leaseId: this.state.lease.id,
            ttlSeconds: 300,
          }),
        },
      );
      if (heartbeat.response.ok && heartbeat.body.lease) {
        this.acceptOwnedLease(holeRef, heartbeat.body.lease);
      } else {
        this.update({
          kind: "CONFLICT",
          holeRef,
          lease: this.state.lease,
          message: "The primary writer lease could not be renewed.",
        });
      }
    } catch {
      const runtime = getPilotBrowserRuntimeContext();
      const cached = runtime?.device
        ? this.readCachedLease(
            runtime.organisationId,
            runtime.device.id,
            holeRef,
          )
        : null;
      if (cached) {
        try {
          this.activateCachedGrace(holeRef, "record", cached);
          return;
        } catch {
          // Fall through to an explicit conflict when grace has expired.
        }
      }
      this.update({
        kind: "CONFLICT",
        holeRef,
        lease: this.state.lease,
        message:
          "The primary writer lease could not be renewed and offline grace is unavailable.",
      });
    }
  }
}

let browserLeaseCoordinator: PilotLeaseCoordinator | null = null;

export function getBrowserPilotLeaseCoordinator(): PilotLeaseCoordinator {
  browserLeaseCoordinator ??= new PilotLeaseCoordinator();
  return browserLeaseCoordinator;
}
