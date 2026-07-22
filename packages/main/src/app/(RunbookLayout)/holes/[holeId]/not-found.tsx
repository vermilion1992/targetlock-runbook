import Link from "next/link";

import { FieldActionButton } from "@/components/field/field-action-button";
import { StatePanel } from "@/components/field/state-panel";

export default function HoleNotFound() {
  return (
    <StatePanel
      state="empty"
      title="Hole not available in Stage 1"
      description="This prototype contains DDH041 only. Open the seeded hole to continue."
      action={
        <FieldActionButton asChild>
          <Link href="/holes/DDH041/current">Open DDH041 current hole</Link>
        </FieldActionButton>
      }
    />
  );
}
