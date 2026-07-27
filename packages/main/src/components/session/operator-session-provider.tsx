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

interface OperatorSessionContextValue {
  readonly loading: boolean;
  readonly session: OperatorSession | null;
  readonly profiles: readonly OperatorProfile[];
  readonly error: string | null;
  signIn(displayName: string, role: OperatorRole): OperatorSession;
  signOut(): void;
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
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [profiles, setProfiles] = useState<readonly OperatorProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const repository = useCallback(() => {
    repositoryRef.current ??= createBrowserOperatorSessionRepository();
    if (repositoryRef.current === null) {
      throw new Error("Browser storage is unavailable.");
    }
    return repositoryRef.current;
  }, []);

  const refresh = useCallback(() => {
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

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === operatorSessionStorageKey()) {
        refresh();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refresh]);

  const signIn = useCallback(
    (displayName: string, role: OperatorRole) => {
      const next = repository().signIn({
        displayName,
        role,
        signedInAt: new Date().toISOString(),
      });
      refresh();
      return next;
    },
    [refresh, repository],
  );

  const signOut = useCallback(() => {
    repository().signOut();
    refresh();
  }, [refresh, repository]);

  const rememberHole = useCallback(
    (holeId: string) => {
      repository().rememberHole(holeId, new Date().toISOString());
      refresh();
    },
    [refresh, repository],
  );

  const value = useMemo<OperatorSessionContextValue>(
    () => ({
      loading,
      session,
      profiles,
      error,
      signIn,
      signOut,
      rememberHole,
      refresh,
    }),
    [
      error,
      loading,
      profiles,
      refresh,
      rememberHole,
      session,
      signIn,
      signOut,
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
