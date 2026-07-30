import Link from "next/link";

export default function PilotSupportPage() {
  return (
    <main className="target-lock mx-auto min-h-dvh max-w-3xl p-6 text-[var(--tl-ink)]">
      <h1 className="text-3xl font-extrabold">
        Pilot support and incident checklist
      </h1>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6">
        <li>Stop duplicate entry and keep the dedicated rig tablet powered.</li>
        <li>
          Record the time, operator, hole, visible lease state and unsynced
          count. Do not copy passwords or cookies.
        </li>
        <li>
          Export a metadata backup and normal shift/hole reports if browser
          storage remains available.
        </li>
        <li>
          For a lost or compromised tablet, revoke the device and affected user
          sessions from another registered supervisor device.
        </li>
        <li>
          Do not take over a writer lease until field staff confirm which tablet
          has the authoritative local record. Enter a specific reason.
        </li>
        <li>
          Escalate through the company-designated support contact and preserve
          relevant screenshots, report files and operation IDs.
        </li>
      </ol>
      <p className="mt-6 rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-950">
        Configure real company and TargetLock support contacts in the controlled
        pilot runbook before mobilisation.
      </p>
      <Link className="mt-8 inline-block font-bold" href="/start">
        Return to TargetLock
      </Link>
    </main>
  );
}
