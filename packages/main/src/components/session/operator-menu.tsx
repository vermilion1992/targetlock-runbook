"use client";

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { useOperatorSession } from "./operator-session-provider";

export function OperatorMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { session, signOut } = useOperatorSession();
  if (session === null) return null;

  return (
    <div className="flex min-w-0 items-center gap-1">
      {!compact ? (
        <div className="hidden min-w-0 items-center gap-2 rounded-md px-2 py-1 sm:flex">
          <UserRound
            aria-hidden="true"
            className="size-4 shrink-0 text-[var(--tl-primary)]"
          />
          <span className="max-w-28 truncate text-xs font-semibold text-[var(--tl-ink)]">
            {session.operator.displayName}
          </span>
        </div>
      ) : null}
      <button
        type="button"
        aria-label={`Sign out ${session.operator.displayName}`}
        title="Sign out"
        className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] text-[var(--tl-ink)]"
        onClick={() => {
          signOut();
          router.replace("/sign-in");
        }}
      >
        <LogOut aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
