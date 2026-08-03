"use client";

import { PencilLine, Save } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  correctComponentAssignment,
  createBrowserRunbookServices,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { FieldNoteLabel } from "@/components/field/field-note-label";
import { MetreInput } from "@/components/field/metre-input";
import { Textarea } from "@/components/ui/textarea";
import {
  decimetresToMetres,
  parseMetreInput,
  type ComponentAssignment,
  type ComponentRemovalReason,
} from "@/domain";

import {
  OperationNotice,
  createComponentLocalId,
  defaultComponentActor,
  titleCase,
} from "./component-support";

const REMOVAL_REASONS: readonly ComponentRemovalReason[] = [
  "WORN",
  "POLISHED",
  "BURNT",
  "DAMAGED",
  "MATRIX_CHANGE",
  "LOST_DOWNHOLE",
  "INSPECTION",
  "HOLE_COMPLETED",
  "OTHER",
];

export function AssignmentCorrectionForm({
  assignment,
  onSaved,
}: {
  assignment: ComponentAssignment;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [startDepth, setStartDepth] = useState(
    decimetresToMetres(assignment.startDepthDm).toFixed(1),
  );
  const [endDepth, setEndDepth] = useState(
    assignment.endDepthDm === undefined
      ? ""
      : decimetresToMetres(assignment.endDepthDm).toFixed(1),
  );
  const [removalReason, setRemovalReason] = useState<
    ComponentRemovalReason | ""
  >(assignment.removalReason ?? "");
  const [removalComment, setRemovalComment] = useState(
    assignment.removalComment ?? "",
  );
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{
    readonly tone: "error" | "success";
    readonly text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const parsedStart = parseMetreInput(startDepth);
    const parsedEnd = endDepth ? parseMetreInput(endDepth) : null;
    if (!parsedStart.ok || (parsedEnd !== null && !parsedEnd.ok)) {
      setMessage({
        tone: "error",
        text: "Assignment boundaries must use non-negative 0.1 m increments.",
      });
      return;
    }
    if (!reason.trim()) {
      setMessage({
        tone: "error",
        text: "An assignment correction reason is required.",
      });
      return;
    }
    if (
      removalReason === "OTHER" &&
      assignment.status === "CLOSED" &&
      !removalComment.trim()
    ) {
      setMessage({
        tone: "error",
        text: "A removal comment is required when Other is selected.",
      });
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage({ tone: "error", text: "Browser storage is unavailable." });
      return;
    }

    setSaving(true);
    const actor = defaultComponentActor();
    try {
      await correctComponentAssignment(
        {
          operationId: createComponentLocalId("correct-assignment"),
          holeId: assignment.holeId,
          assignmentId: assignment.localId,
          expectedVersion: assignment.version,
          startDepthDm: parsedStart.value,
          endDepthDm:
            assignment.status === "ACTIVE"
              ? undefined
              : parsedEnd?.ok === true
                ? parsedEnd.value
                : assignment.endDepthDm,
          removalReason:
            assignment.status === "CLOSED" && removalReason
              ? removalReason
              : undefined,
          removalComment:
            assignment.status === "CLOSED"
              ? removalComment.trim() || undefined
              : undefined,
          reason: reason.trim(),
          userId: actor.userId,
          userNameSnapshot: actor.userName,
          occurredAt: new Date().toISOString(),
        },
        services,
      );
      await onSaved();
      setReason("");
      setMessage({
        tone: "success",
        text: "Assignment correction saved; previous boundaries remain audited.",
      });
    } catch (cause) {
      setMessage({
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "The assignment correction could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-[var(--tl-border)] pt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--tl-primary)]"
      >
        <PencilLine aria-hidden="true" className="size-4" />
        Correct assignment
      </button>
      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-4">
          {message ? (
            <OperationNotice tone={message.tone}>{message.text}</OperationNotice>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <MetreInput
              label="Start depth"
              value={startDepth}
              onValueChange={setStartDepth}
              required
            />
            <MetreInput
              label="End depth"
              value={endDepth}
              onValueChange={setEndDepth}
              disabled={assignment.status === "ACTIVE"}
              helpText={
                assignment.status === "ACTIVE"
                  ? "Active assignments do not have an end boundary."
                  : undefined
              }
              required={assignment.status === "CLOSED"}
            />
          </div>
          {assignment.status === "CLOSED" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-[var(--tl-ink)]">
                Removal reason
                <select
                  value={removalReason}
                  onChange={(event) =>
                    setRemovalReason(
                      event.target.value as ComponentRemovalReason | "",
                    )
                  }
                  className="mt-2 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
                >
                  <option value="">Not recorded</option>
                  {REMOVAL_REASONS.map((value) => (
                    <option key={value} value={value}>
                      {titleCase(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <FieldNoteLabel label="Removal note" />
                <Textarea
                  value={removalComment}
                  onChange={(event) => setRemovalComment(event.target.value)}
                  className="mt-2 border-[var(--tl-border-strong)]"
                  placeholder="Example: Removed after excessive wear was confirmed at surface."
                />
              </label>
            </div>
          ) : null}
          <label className="block text-sm font-bold text-[var(--tl-ink)]">
            Correction reason <span className="text-[var(--tl-danger)]">*</span>
            <Textarea
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 border-[var(--tl-border-strong)]"
              placeholder="Explain why the assignment boundary is being corrected."
            />
          </label>
          <FieldActionButton type="submit" busy={saving}>
            <Save aria-hidden="true" className="size-4" />
            Save assignment correction
          </FieldActionButton>
        </form>
      ) : null}
    </div>
  );
}
