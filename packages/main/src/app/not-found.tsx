import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="target-lock grid min-h-dvh place-items-center bg-[var(--tl-app-bg)] p-5 text-[var(--tl-ink)]">
      <div className="w-full max-w-lg rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-6 text-center shadow-[var(--tl-shadow-md)]">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--tl-primary)]">
          TargetLock · 404
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.035em]">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--tl-ink-muted)]">
          This address is not part of the available field workspace.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--tl-primary)] px-5 font-bold text-white no-underline"
        >
          Open TargetLock
        </Link>
      </div>
    </main>
  );
}
