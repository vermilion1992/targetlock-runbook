import Link from "next/link";

export default function PilotTermsPage() {
  return (
    <main className="target-lock mx-auto min-h-dvh max-w-3xl p-6 text-[var(--tl-ink)]">
      <h1 className="text-3xl font-extrabold">
        Controlled pilot terms, privacy and data ownership
      </h1>
      <p className="mt-3 text-sm font-semibold text-amber-700">
        Operational checklist only; not legal advice.
      </p>
      <div className="mt-6 space-y-5 text-sm leading-6">
        <section>
          <h2 className="text-lg font-bold">Pilot boundary</h2>
          <p>
            TargetLock Stage 7C is a one-rig pilot with authoritative recovery
            for its core drilling workflow. It is not a certified
            anti-collision, telemetry or complete live multi-device system.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold">Data location</h2>
          <p>
            Accounts, devices, leases, the validated operation journal and
            accepted core Project/Hole/BHA/Shift/Run/Rod/Handover projections
            are held on the pilot server. Peripheral records and media blobs
            remain in the dedicated browser. Conflicts are not auto-merged.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold">Ownership and access</h2>
          <p>
            The drilling company controls its operational data and named user
            access. Use individual accounts, revoke departed users and devices,
            and do not share temporary passwords.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold">Retention and export</h2>
          <p>
            Agree retention, deletion and support contacts before field use.
            Metadata backup exports do not contain recoverable photo/report
            blobs; preserve the dedicated tablet and normal reports.
          </p>
        </section>
      </div>
      <Link className="mt-8 inline-block font-bold" href="/start">
        Return to TargetLock
      </Link>
    </main>
  );
}
