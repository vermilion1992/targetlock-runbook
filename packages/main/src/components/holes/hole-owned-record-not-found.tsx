import Link from "next/link";

import { FieldActionButton } from "@/components/field/field-action-button";
import { StatePanel } from "@/components/field/state-panel";
import { runbookRoutes } from "@/components/navigation/runbook-routes";

export function HoleOwnedRecordNotFound({ holeId }: { holeId: string }) {
  return (
    <StatePanel
      state="empty"
      title="Record not available for this hole"
      description="The requested record belongs to another hole or is no longer available."
      action={
        <FieldActionButton asChild>
          <Link href={runbookRoutes.runbook(holeId)}>
            Return to this hole&apos;s runbook
          </Link>
        </FieldActionButton>
      }
    />
  );
}
