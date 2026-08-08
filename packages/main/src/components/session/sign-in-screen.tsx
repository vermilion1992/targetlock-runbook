"use client";

import {
  ArrowRight,
  Drill,
  HardDrive,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ThemeModeControl } from "@/components/app-shell/theme-mode-control";
import type { OperatorRole } from "@/infrastructure/session";
import { useOperatorSession } from "./operator-session-provider";
import { parsePilotLoginInput } from "./pilot-login-input";

const roleOptions: readonly {
  value: OperatorRole;
  label: string;
  description: string;
  icon: typeof Drill;
}[] = [
  {
    value: "DRILLER",
    label: "Driller",
    description: "Record shifts, runs and field observations.",
    icon: Drill,
  },
  {
    value: "SUPERVISOR",
    label: "Supervisor",
    description: "Review projects, holes and completion records.",
    icon: ShieldCheck,
  },
];

export function SignInScreen({
  destination = "/start",
  notice = null,
}: {
  destination?: string;
  notice?: "session-expired" | null;
}) {
  const router = useRouter();
  const {
    loading,
    runtimeMode,
    session,
    profiles,
    error,
    betaGuestAllowed,
    signIn,
    enterBetaGuest,
    pilotSignIn,
  } = useOperatorSession();
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<OperatorRole>("DRILLER");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"pilot" | "demo" | null>(null);

  function completeSignIn(name: string, selectedRole: OperatorRole) {
    if (submitting) return;
    setSubmitting("demo");
    setFormError(null);
    try {
      signIn(name, selectedRole);
      router.replace(destination);
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : "This operator could not be signed in.",
      );
      setSubmitting(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = displayName.trim().replace(/\s+/g, " ");
    if (normalized.length < 2) {
      setFormError("Enter the operator's full name.");
      return;
    }
    completeSignIn(normalized, role);
  }

  async function handlePilotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const formData = new FormData(event.currentTarget);
    const parsed = parsePilotLoginInput({
      organisation: formData.get("organisation"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.ok) {
      setFormError(parsed.message);
      return;
    }
    const submitted = parsed.input;
    setOrganisation(submitted.organisation);
    setEmail(submitted.email);
    setPassword(submitted.password);
    setSubmitting("pilot");
    setFormError(null);
    try {
      await pilotSignIn(
        submitted.organisation,
        submitted.email,
        submitted.password,
      );
      router.replace(destination);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "Pilot sign-in failed.",
      );
      setSubmitting(null);
    }
  }

  async function handleDemoClick() {
    if (submitting) return;
    setSubmitting("demo");
    setFormError(null);
    try {
      await enterBetaGuest();
      router.replace("/holes/DDH041/current");
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : "Demo mode could not be started.",
      );
      setSubmitting(null);
    }
  }

  return (
    <main className="target-lock relative min-h-dvh overflow-hidden bg-[var(--tl-canvas)] text-[var(--tl-ink)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,var(--tl-primary-soft),transparent_68%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="flex min-h-12 items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logos/targetlock-mark.svg"
              alt=""
              width={42}
              height={42}
              priority
              className="size-10"
            />
            <span className="text-lg font-extrabold tracking-[-0.03em]">
              Target<span className="text-[var(--tl-primary)]">Lock</span>
            </span>
          </div>
          <ThemeModeControl />
        </header>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-16">
          <section className="hidden max-w-xl lg:block">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--tl-primary)]">
              Secure field operations
            </p>
            <h1 className="mt-4 text-5xl font-extrabold leading-[1.05] tracking-[-0.045em]">
              Start with the right operator, rig tablet and work context.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-[var(--tl-ink-muted)]">
              Core field records save locally first and are validated into the
              authoritative server record when connectivity permits. Media and
              generated report files remain on their original tablet.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
                <HardDrive
                  aria-hidden="true"
                  className="size-5 text-[var(--tl-primary)]"
                />
                <p className="mt-3 font-bold">Local-first capture</p>
                <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                  Continue field work without depending on coverage.
                </p>
              </div>
              <div className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-5 text-[var(--tl-primary)]"
                />
                <p className="mt-3 font-bold">Authoritative recovery</p>
                <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                  Core work can be restored to an authorised replacement tablet.
                </p>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="sign-in-heading"
            className="mx-auto w-full max-w-md rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-5 shadow-[var(--tl-shadow-md)] sm:p-7"
          >
            <div className="flex size-12 items-center justify-center rounded-[var(--tl-radius-md)] bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]">
              <UserRound aria-hidden="true" className="size-6" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--tl-primary)]">
              Secure access
            </p>
            <h1
              id="sign-in-heading"
              className="mt-1 text-3xl font-extrabold tracking-[-0.035em]"
            >
              Sign in to TargetLock
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--tl-ink-muted)]">
              {runtimeMode === "pilot"
                ? "Use the account provisioned by your company administrator. Your role is assigned by the server."
                : "Select a recent operator or enter your details to open the field workspace."}
            </p>

            {notice === "session-expired" ? (
              <p
                role="alert"
                className="mt-4 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
              >
                Your secure pilot session expired or was revoked. Sign in again.
                The registered-device cookie remains on this dedicated tablet.
              </p>
            ) : null}

            {session ? (
              <button
                type="button"
                className="mt-5 flex min-h-14 w-full items-center justify-between rounded-[var(--tl-radius-md)] border-2 border-[var(--tl-primary)] bg-[var(--tl-primary-soft)] px-4 text-left"
                onClick={() => router.replace(destination)}
              >
                <span>
                  <span className="block text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                    Already signed in
                  </span>
                  <span className="font-bold">{session.operator.displayName}</span>
                </span>
                <ArrowRight aria-hidden="true" className="size-5" />
              </button>
            ) : null}

            {runtimeMode === "demo" && !loading && profiles.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-bold">Recent operators</p>
                <div className="mt-2 grid gap-2">
                  {profiles.slice(0, 3).map((profile) => (
                    <button
                      key={profile.localId}
                      type="button"
                      disabled={submitting !== null}
                      className="flex min-h-12 items-center justify-between rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-4 text-left disabled:opacity-60"
                      onClick={() =>
                        completeSignIn(profile.displayName, profile.role)
                      }
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">
                          {profile.displayName}
                        </span>
                        <span className="text-xs text-[var(--tl-ink-muted)]">
                          {profile.role === "DRILLER" ? "Driller" : "Supervisor"}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                    </button>
                  ))}
                </div>
                <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                  <span className="h-px flex-1 bg-[var(--tl-border)]" />
                  Another operator
                  <span className="h-px flex-1 bg-[var(--tl-border)]" />
                </div>
              </div>
            ) : null}

            {runtimeMode === "pilot" ? (
              <form
                onSubmit={(event) => void handlePilotSubmit(event)}
                className="mt-6"
                noValidate
              >
                <label
                  htmlFor="organisation"
                  className="block text-sm font-bold"
                >
                  Organisation
                </label>
                <input
                  id="organisation"
                  name="organisation"
                  value={organisation}
                  onChange={(event) => {
                    setOrganisation(event.target.value);
                    if (formError) setFormError(null);
                  }}
                  autoComplete="organization"
                  maxLength={80}
                  required
                  placeholder="Company pilot code"
                  className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-4 text-base outline-none focus:border-[var(--tl-primary)] focus:ring-2 focus:ring-[var(--tl-primary-soft)]"
                />
                <label
                  htmlFor="pilot-email"
                  className="mt-4 block text-sm font-bold"
                >
                  Email
                </label>
                <input
                  id="pilot-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (formError) setFormError(null);
                  }}
                  autoComplete="username"
                  maxLength={320}
                  required
                  className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-4 text-base outline-none focus:border-[var(--tl-primary)] focus:ring-2 focus:ring-[var(--tl-primary-soft)]"
                />
                <label
                  htmlFor="pilot-password"
                  className="mt-4 block text-sm font-bold"
                >
                  Password
                </label>
                <input
                  id="pilot-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (formError) setFormError(null);
                  }}
                  autoComplete="current-password"
                  minLength={10}
                  maxLength={200}
                  required
                  className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-4 text-base outline-none focus:border-[var(--tl-primary)] focus:ring-2 focus:ring-[var(--tl-primary-soft)]"
                />
                {formError || error ? (
                  <p
                    role="alert"
                    className="mt-4 rounded-md bg-[var(--tl-danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--tl-danger)]"
                  >
                    {formError ?? error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting !== null || loading}
                  className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-5 font-bold text-white shadow-[var(--tl-shadow-sm)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting === "pilot" ? "Verifying account…" : "Sign in securely"}
                  {submitting !== "pilot" ? (
                    <ArrowRight aria-hidden="true" className="size-5" />
                  ) : null}
                </button>
                {betaGuestAllowed && !session ? (
                  <>
                    <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase text-[var(--tl-ink-muted)]">
                      <span className="h-px flex-1 bg-[var(--tl-border)]" />
                      Or
                      <span className="h-px flex-1 bg-[var(--tl-border)]" />
                    </div>
                    <button
                      type="button"
                      disabled={submitting !== null || loading}
                      onClick={() => void handleDemoClick()}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-5 font-bold text-[var(--tl-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                      data-testid="beta-guest-demo-button"
                    >
                      {submitting === "demo" ? "Opening demo…" : "Try demo"}
                    </button>
                    <p className="mt-2 text-xs leading-5 text-[var(--tl-ink-muted)]">
                      Local-only beta sandbox on hole DDH041 (~800 m plan /
                      ~630 m mid-hole). Changes stay in this browser and are
                      never synced to the pilot server.
                    </p>
                  </>
                ) : null}
              </form>
            ) : runtimeMode === "demo" ? (
              <form
                onSubmit={handleSubmit}
                className={profiles.length > 0 ? "" : "mt-6"}
                noValidate
              >
              <label
                htmlFor="operator-name"
                className="block text-sm font-bold"
              >
                Operator name
              </label>
              <input
                id="operator-name"
                name="operatorName"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  if (formError) setFormError(null);
                }}
                autoComplete="name"
                autoCapitalize="words"
                maxLength={100}
                required
                placeholder="Full name"
                className="mt-2 min-h-12 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] px-4 text-base outline-none focus:border-[var(--tl-primary)] focus:ring-2 focus:ring-[var(--tl-primary-soft)]"
              />

              <fieldset className="mt-5">
                <legend className="text-sm font-bold">Role</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {roleOptions.map((option) => {
                    const Icon = option.icon;
                    const checked = role === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-[var(--tl-radius-md)] border-2 p-3 ${
                          checked
                            ? "border-[var(--tl-primary)] bg-[var(--tl-primary-soft)]"
                            : "border-[var(--tl-border)] bg-[var(--tl-surface-raised)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="operatorRole"
                          value={option.value}
                          checked={checked}
                          onChange={() => setRole(option.value)}
                          className="sr-only"
                        />
                        <Icon
                          aria-hidden="true"
                          className="size-5 text-[var(--tl-primary)]"
                        />
                        <span className="mt-2 block text-sm font-bold">
                          {option.label}
                        </span>
                        <span className="mt-1 hidden text-xs leading-5 text-[var(--tl-ink-muted)] sm:block">
                          {option.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {formError || error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-md bg-[var(--tl-danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--tl-danger)]"
                >
                  {formError ?? error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting !== null || loading}
                className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-5 font-bold text-white shadow-[var(--tl-shadow-sm)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting !== null ? "Opening workspace…" : "Sign in on this device"}
                {submitting === null ? (
                  <ArrowRight aria-hidden="true" className="size-5" />
                ) : null}
              </button>
              </form>
            ) : (
              <p role="status" className="mt-6 text-sm font-semibold">
                Checking pilot configuration…
              </p>
            )}

            <div className="mt-5 flex items-start gap-2 border-t border-[var(--tl-border)] pt-4 text-xs leading-5 text-[var(--tl-ink-muted)]">
              <HardDrive aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>
                {runtimeMode === "pilot"
                  ? "Account, role and device assignment are server-backed. Core Project, Rig, Hole, BHA, Shift, Run and Handover records support authoritative recovery; media and report files remain local."
                  : "Local demo sign-in identifies records on this browser. It is not account security or cross-device authentication."}
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
