import Link from "next/link";

import { FieldActionButton } from "@/components/field/field-action-button";
import { StatePanel } from "@/components/field/state-panel";

export default function HoleNotFound() {
  return (
    <StatePanel
      state="empty"
      title="Hole or record not available"
      description="The requested hole or hole-owned record could not be found."
      action={
        <FieldActionButton asChild>
          <Link href="/start">Choose or create a hole</Link>
        </FieldActionButton>
      }
    />
  );
}
