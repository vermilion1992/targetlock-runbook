"use client";

import Link from "next/link";

import { FieldActionButton } from "@/components/field/field-action-button";
import { StatePanel } from "@/components/field/state-panel";

interface HoleErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function HoleError({ error, reset }: HoleErrorProps) {
  return (
    <StatePanel
      state="error"
      title="This hole view could not load"
      description={
        <>
          <p>{error.message || "An unexpected field-view error occurred."}</p>
          <p className="mt-1">
            Locally saved browser drafts have not been removed.
          </p>
        </>
      }
      action={
        <div className="flex flex-col gap-2 sm:flex-row">
          <FieldActionButton onClick={reset}>Try again</FieldActionButton>
          <FieldActionButton variant="secondary" asChild>
            <Link href="/holes/DDH041/current">Open DDH041</Link>
          </FieldActionButton>
        </div>
      }
    />
  );
}
