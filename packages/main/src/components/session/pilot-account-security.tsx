"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOperatorSession } from "./operator-session-provider";

export function PilotAccountSecurity() {
  const router = useRouter();
  const { pilot, runtimeMode } = useOperatorSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (runtimeMode !== "pilot" || pilot === null) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-black">Account security</h1>
        <p className="mt-3 text-sm text-[var(--tl-ink-muted)]">
          Password changes apply to secure pilot accounts only.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--tl-primary)]">
        Secure pilot account
      </p>
      <h1 className="mt-2 text-3xl font-black">Account security</h1>
      <p className="mt-2 text-sm text-[var(--tl-ink-muted)]">
        Change your own password. This revokes every operator session while
        preserving this tablet&apos;s separate device registration.
      </p>
      {pilot.mustChangePassword ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-950"
        >
          This account is using a temporary password. Change it before field
          work.
        </p>
      ) : null}
      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          const form = new FormData(event.currentTarget);
          const currentPassword = String(form.get("currentPassword") ?? "");
          const newPassword = String(form.get("newPassword") ?? "");
          const confirmation = String(form.get("confirmation") ?? "");
          if (newPassword !== confirmation) {
            setError("The new password confirmation does not match.");
            return;
          }
          setBusy(true);
          setError(null);
          void fetch("/api/pilot/auth/change-password", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword }),
          })
            .then(async (response) => {
              const body = (await response.json()) as {
                error?: { message?: string };
              };
              if (!response.ok) {
                throw new Error(
                  body.error?.message ?? "The password could not be changed.",
                );
              }
              router.replace("/sign-in");
              router.refresh();
            })
            .catch((cause: unknown) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "The password could not be changed.",
              );
              setBusy(false);
            });
        }}
      >
        <PasswordInput
          name="currentPassword"
          label="Current password"
          minLength={10}
        />
        <PasswordInput
          name="newPassword"
          label="New password"
          minLength={12}
        />
        <PasswordInput
          name="confirmation"
          label="Confirm new password"
          minLength={12}
        />
        {error ? (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-md bg-[var(--tl-primary)] px-4 font-bold text-white disabled:opacity-60"
        >
          {busy ? "Changing password…" : "Change password and sign out"}
        </button>
      </form>
    </main>
  );
}

function PasswordInput({
  label,
  name,
  minLength,
}: {
  label: string;
  name: string;
  minLength: number;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input
        required
        type="password"
        name={name}
        minLength={minLength}
        autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
        className="mt-1 min-h-11 w-full rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 font-normal"
      />
    </label>
  );
}
