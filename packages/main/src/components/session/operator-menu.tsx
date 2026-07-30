"use client";

import { Download, KeyRound, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useOperatorSession } from "./operator-session-provider";
import { downloadPilotBackup } from "@/infrastructure/backup";

export function OperatorMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { runtimeMode, session, pilot, signOut } = useOperatorSession();
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
      {runtimeMode === "pilot" ? (
        <>
          <button
            type="button"
            aria-label="Export pilot recovery metadata"
            title="Export recovery metadata"
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] text-[var(--tl-ink)]"
            onClick={() => {
              if (!pilot) return;
              void downloadPilotBackup({
                organisationId: pilot.organisationId,
                operatorId: pilot.operatorId,
              }).catch((cause: unknown) => {
                window.alert(
                  cause instanceof Error
                    ? cause.message
                    : "Pilot recovery metadata could not be exported.",
                );
              });
            }}
          >
            <Download aria-hidden="true" className="size-4" />
          </button>
          <Link
            href="/pilot-account"
            aria-label="Account security and password"
            title="Account security"
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] text-[var(--tl-ink)]"
          >
            <KeyRound aria-hidden="true" className="size-4" />
          </Link>
        </>
      ) : null}
      <button
        type="button"
        aria-label={`Sign out ${session.operator.displayName}`}
        title="Sign out"
        className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] text-[var(--tl-ink)]"
        onClick={() => {
          void signOut()
            .then(() => router.replace("/sign-in"))
            .catch((cause: unknown) => {
              window.alert(
                cause instanceof Error
                  ? cause.message
                  : "Sign out was blocked by pending pilot recovery work.",
              );
            });
        }}
      >
        <LogOut aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
