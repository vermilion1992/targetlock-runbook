"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  createBrowserOperatorSessionRepository,
  operatorSessionStorageKey,
  type OperatorProfile,
  type OperatorRole,
  type OperatorSession,
  type OperatorSessionRepository,
} from "@/infrastructure/session";
import {
  configureDemoBrowserRuntime,
  configurePilotBrowserRuntime,
  getBrowserSyncCoordinator,
  requireClearPilotOutboxForContextExit,
} from "@/infrastructure/sync";

type RuntimeMode = "loading" | "demo" | "pilot";

interface PilotClientContext {
  readonly organisationId: string;
  readonly operatorId: string;
  readonly organisationName: string;
  readonly serverRole: "COMPANY_ADMIN" | "SUPERVISOR" | "DRILLER";
  readonly sessionExpiresAt: string;
  readonly mustChangePassword: boolean;
  readonly device: {
    readonly id: string;
    readonly displayName: string;
    readonly siteName: string | null;
    readonly projectRef: string | null;
    readonly rigRef: string | null;
  } | null;
  readonly sessionVerified: boolean;
  readonly deviceVerified: boolean;
  readonly domainWrites: "LOCAL_WITH_SERVER_JOURNAL";
  readonly serverJournal: "AUDIT_BACKUP_ONLY";
  readonly mediaBlobs: "LOCAL_ONLY";
}

interface OperatorSessionContextValue {
  readonly loading: boolean;
  readonly runtimeMode: RuntimeMode;
  readonly session: OperatorSession | null;
  readonly profiles: readonly OperatorProfile[];
  readonly pilot: PilotClientContext | null;
  readonly error: string | null;
  signIn(displayName: string, role: OperatorRole): OperatorSession;
  pilotSignIn(organisation: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  rememberHole(holeId: string): void;
  refresh(): void;
}

const OperatorSessionContext =
  createContext<OperatorSessionContextValue | null>(null);

export function OperatorSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const repositoryRef = useRef<OperatorSessionRepository | null>(null);
  const [loading, setLoading] = useState(true);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("loading");
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [profiles, setProfiles] = useState<readonly OperatorProfile[]>([]);
  const [pilot, setPilot] = useState<PilotClientContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const repository = useCallback(() => {
    repositoryRef.current ??= createBrowserOperatorSessionRepository();
    if (repositoryRef.current === null) {
      throw new Error("Browser storage is unavailable.");
    }
    return repositoryRef.current;
  }, []);

  const refreshDemo = useCallback(() => {
    try {
      const snapshot = repository().getSnapshot();
      setSession(snapshot.session);
      setProfiles(snapshot.profiles);
      setError(null);
    } catch (cause) {
      setSession(null);
      setProfiles([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "The operator session could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [repository]);

  const refreshPilot = useCallback(async () => {
    const response = await fetch("/api/pilot/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const body = (await response.json()) as {
      mode?: "demo" | "pilot";
      authenticated?: boolean;
      user?: {
        id: string;
        organisationId: string;
        organisationName: string;
        displayName: string;
        role: "COMPANY_ADMIN" | "SUPERVISOR" | "DRILLER";
        mustChangePassword: boolean;
        sessionExpiresAt: string;
      };
      device?: PilotClientContext["device"];
      sync?: {
        sessionVerified: boolean;
        deviceVerified: boolean;
        domainWrites: "LOCAL_WITH_SERVER_JOURNAL";
        serverJournal: "AUDIT_BACKUP_ONLY";
        mediaBlobs: "LOCAL_ONLY";
      };
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(body.error?.message ?? "Pilot session is unavailable.");
    }
    if (body.mode === "demo") {
      configureDemoBrowserRuntime();
      setRuntimeMode("demo");
      setPilot(null);
      refreshDemo();
      return;
    }
    setRuntimeMode("pilot");
    setProfiles([]);
    if (!body.authenticated || !body.user || !body.sync) {
      setSession(null);
      setPilot(null);
      configurePilotBrowserRuntime(null);
      setError(null);
      setLoading(false);
      return;
    }
    const role: OperatorRole =
      body.user.role === "DRILLER" ? "DRILLER" : "SUPERVISOR";
    const lastHoleId =
      window.localStorage.getItem(
        `targetlock:pilot:last-hole:${body.user.id}`,
      ) ?? undefined;
    setSession({
      operator: {
        localId: body.user.id,
        displayName: body.user.displayName,
        role,
        serverRole: body.user.role,
        organisationName: body.user.organisationName,
        createdAt: new Date().toISOString(),
        lastSignedInAt: new Date().toISOString(),
        ...(lastHoleId ? { lastHoleId } : {}),
      },
      signedInAt: new Date().toISOString(),
      ...(lastHoleId ? { lastHoleId } : {}),
    });
    setPilot({
      organisationId: body.user.organisationId,
      operatorId: body.user.id,
      organisationName: body.user.organisationName,
      serverRole: body.user.role,
      sessionExpiresAt: body.user.sessionExpiresAt,
      mustChangePassword: body.user.mustChangePassword === true,
      device: body.device ?? null,
      sessionVerified: body.sync.sessionVerified,
      deviceVerified: body.sync.deviceVerified,
      domainWrites: body.sync.domainWrites,
      serverJournal: body.sync.serverJournal,
      mediaBlobs: body.sync.mediaBlobs,
    });
    configurePilotBrowserRuntime({
      mode: "pilot",
      organisationId: body.user.organisationId,
      operatorId: body.user.id,
      operatorName: body.user.displayName,
      role: body.user.role,
      device: body.device
        ? {
            id: body.device.id,
            projectRef: body.device.projectRef,
            rigRef: body.device.rigRef,
          }
        : null,
      sessionExpiresAt: body.user.sessionExpiresAt,
    });
    void getBrowserSyncCoordinator()?.flush();
    setError(null);
    setLoading(false);
  }, [refreshDemo]);

  const refresh = useCallback(() => {
    if (runtimeMode === "demo") {
      refreshDemo();
      return;
    }
    void refreshPilot().catch((cause: unknown) => {
      setSession(null);
      setPilot(null);
      configurePilotBrowserRuntime(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Pilot session is unavailable.",
      );
      setLoading(false);
    });
  }, [refreshDemo, refreshPilot, runtimeMode]);

  useEffect(() => {
    void Promise.resolve()
      .then(refreshPilot)
      .catch((cause: unknown) => {
        setRuntimeMode("pilot");
        setSession(null);
        setPilot(null);
        configurePilotBrowserRuntime(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "Pilot session is unavailable.",
        );
        setLoading(false);
      });
    const handleStorage = (event: StorageEvent) => {
      if (
        runtimeMode === "demo" &&
        (event.key === null || event.key === operatorSessionStorageKey())
      ) {
        refreshDemo();
      }
    };
    const handleSessionExpiry = () => {
      configurePilotBrowserRuntime(null);
      setSession(null);
      setPilot(null);
      setError("Your secure pilot session expired. Sign in again.");
      setLoading(false);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      "targetlock:pilot-session-expired",
      handleSessionExpiry,
    );
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "targetlock:pilot-session-expired",
        handleSessionExpiry,
      );
    };
  }, [refreshDemo, refreshPilot, runtimeMode]);

  const signIn = useCallback(
    (displayName: string, role: OperatorRole) => {
      if (runtimeMode !== "demo") {
        throw new Error("Pilot accounts must sign in with email and password.");
      }
      const next = repository().signIn({
        displayName,
        role,
        signedInAt: new Date().toISOString(),
      });
      refreshDemo();
      return next;
    },
    [refreshDemo, repository, runtimeMode],
  );

  const pilotSignIn = useCallback(
    async (organisation: string, email: string, password: string) => {
      const response = await fetch("/api/pilot/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisation, email, password }),
      });
      const body = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Pilot sign-in failed.");
      }
      await refreshPilot();
    },
    [refreshPilot],
  );

  const signOut = useCallback(async () => {
    if (runtimeMode === "pilot") {
      try {
        await requireClearPilotOutboxForContextExit();
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Pending journal entries must be recovered before logout.";
        setError(message);
        throw cause;
      }
      const response = await fetch("/api/pilot/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("The server session could not be revoked.");
      }
      setSession(null);
      setPilot(null);
      configurePilotBrowserRuntime(null);
      return;
    }
    repository().signOut();
    refreshDemo();
  }, [refreshDemo, repository, runtimeMode]);

  const rememberHole = useCallback(
    (holeId: string) => {
      if (runtimeMode === "pilot") {
        if (session === null) return;
        window.localStorage.setItem(
          `targetlock:pilot:last-hole:${session.operator.localId}`,
          holeId,
        );
        setSession({
          ...session,
          lastHoleId: holeId,
          operator: { ...session.operator, lastHoleId: holeId },
        });
        return;
      }
      repository().rememberHole(holeId, new Date().toISOString());
      refreshDemo();
    },
    [refreshDemo, repository, runtimeMode, session],
  );

  const value = useMemo<OperatorSessionContextValue>(
    () => ({
      loading,
      runtimeMode,
      session,
      profiles,
      pilot,
      error,
      signIn,
      pilotSignIn,
      signOut,
      rememberHole,
      refresh,
    }),
    [
      error,
      loading,
      pilot,
      pilotSignIn,
      profiles,
      refresh,
      rememberHole,
      session,
      signIn,
      signOut,
      runtimeMode,
    ],
  );

  return (
    <OperatorSessionContext.Provider value={value}>
      {children}
    </OperatorSessionContext.Provider>
  );
}

export function useOperatorSession(): OperatorSessionContextValue {
  const value = useContext(OperatorSessionContext);
  if (value === null) {
    throw new Error(
      "useOperatorSession must be used within OperatorSessionProvider.",
    );
  }
  return value;
}
