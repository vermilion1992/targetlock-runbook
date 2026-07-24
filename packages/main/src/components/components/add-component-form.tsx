"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  createComponent,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { SectionPanel } from "@/components/field/section-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  parseMetreInput,
  type ComponentType,
} from "@/domain";
import { ComponentRepositoryError } from "@/infrastructure/components";
import { targetLockStage3Seed } from "@/infrastructure/seed";

import {
  COMPONENT_TYPES,
  OperationNotice,
  createComponentLocalId,
  defaultComponentActor,
  titleCase,
} from "./component-support";

type NewComponentStatus =
  | "AVAILABLE"
  | "SERVICEABLE"
  | "UNDER_INSPECTION"
  | "REMOVED"
  | "RETIRED"
  | "LOST_DOWNHOLE";

const NEW_COMPONENT_STATUSES: readonly NewComponentStatus[] = [
  "AVAILABLE",
  "SERVICEABLE",
  "UNDER_INSPECTION",
  "REMOVED",
  "RETIRED",
  "LOST_DOWNHOLE",
];

function formValue(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function FieldLabel({
  htmlFor,
  children,
  required = false,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-bold text-[var(--tl-ink)]"
    >
      {children}
      {required ? <span className="ml-1 text-[var(--tl-danger)]">*</span> : null}
    </label>
  );
}

export function AddComponentForm({
  initialType = "BIT",
}: {
  initialType?: ComponentType;
}) {
  const router = useRouter();
  const [type, setType] = useState<ComponentType>(initialType);
  const [status, setStatus] = useState<NewComponentStatus>("AVAILABLE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.componentRegistry();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const values = new FormData(event.currentTarget);
    const serialNumber = formValue(values, "serialNumber");
    const size = formValue(values, "size");
    const crownHeight = formValue(values, "startingCrownHeight");
    const parsedCrown = crownHeight ? parseMetreInput(crownHeight) : null;
    if (!serialNumber || !size) {
      setError("Serial number and size are required.");
      setSaving(false);
      return;
    }
    if (parsedCrown !== null && !parsedCrown.ok) {
      setError("Starting crown height must use non-negative 0.1 m increments.");
      setSaving(false);
      return;
    }

    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable. The component was not saved.");
      setSaving(false);
      return;
    }

    const actor = defaultComponentActor();
    const occurredAt = new Date().toISOString();
    const id = createComponentLocalId(`component-${type.toLocaleLowerCase("en-AU")}`);
    try {
      await createComponent(
        {
          id,
          organisationId: targetLockStage3Seed.organisation.localId,
          auditHoleId: targetLockStage3Seed.hole.name,
          type,
          serialNumber,
          manufacturer: formValue(values, "manufacturer") || undefined,
          model: formValue(values, "model") || undefined,
          matrix: formValue(values, "matrix") || undefined,
          size,
          supplier: formValue(values, "supplier") || undefined,
          startingCrownHeightDm:
            parsedCrown?.ok === true ? parsedCrown.value : undefined,
          status,
          notes: formValue(values, "notes") || undefined,
          userId: actor.userId,
          userNameSnapshot: actor.userName,
          occurredAt,
        },
        services,
      );
      setIsDirty(false);
      router.push(
        `${runbookRoutes.componentDetail(id)}?notice=component-created`,
      );
    } catch (cause) {
      setError(
        cause instanceof ComponentRepositoryError &&
          cause.code === "DUPLICATE_SERIAL"
          ? `Duplicate serial number: ${cause.message}`
          : cause instanceof Error
            ? cause.message
            : "The component could not be saved.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Stage 3 · registry entry"
        title="Add component"
        description="Create an audited local registry record. Active status is set only through an assignment workflow."
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      <form
        onSubmit={handleSubmit}
        onChange={() => setIsDirty(true)}
        className="space-y-5"
      >
        <SectionPanel
          title="Registry details"
          description="Serial number uniqueness is enforced within each component type."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="component-type" required>Type</FieldLabel>
              <select
                id="component-type"
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as ComponentType)}
                className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
              >
                {COMPONENT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="component-serial" required>Serial number</FieldLabel>
              <Input
                id="component-serial"
                name="serialNumber"
                required
                maxLength={100}
                autoComplete="off"
                className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
              />
            </div>
            <div>
              <FieldLabel htmlFor="component-manufacturer">Manufacturer</FieldLabel>
              <Input id="component-manufacturer" name="manufacturer" maxLength={100} className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base" />
            </div>
            <div>
              <FieldLabel htmlFor="component-model">Model</FieldLabel>
              <Input id="component-model" name="model" maxLength={100} className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base" />
            </div>
            <div>
              <FieldLabel htmlFor="component-size" required>Size</FieldLabel>
              <Input id="component-size" name="size" required maxLength={30} placeholder="For example, HQ" className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base" />
            </div>
            <div>
              <FieldLabel htmlFor="component-matrix">Matrix</FieldLabel>
              <Input id="component-matrix" name="matrix" maxLength={100} className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base" />
            </div>
            <div>
              <FieldLabel htmlFor="component-supplier">Supplier</FieldLabel>
              <Input id="component-supplier" name="supplier" maxLength={100} className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base" />
            </div>
            <div>
              <FieldLabel htmlFor="component-crown">Starting crown height (m)</FieldLabel>
              <Input
                id="component-crown"
                name="startingCrownHeight"
                inputMode="decimal"
                placeholder="For example, 1.2"
                className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
              />
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">Optional · 0.1 m precision.</p>
            </div>
            <div>
              <FieldLabel htmlFor="component-status" required>Initial status</FieldLabel>
              <select
                id="component-status"
                name="status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as NewComponentStatus,
                  )
                }
                className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
              >
                {NEW_COMPONENT_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <FieldLabel htmlFor="component-notes">Notes</FieldLabel>
              <Textarea
                id="component-notes"
                name="notes"
                maxLength={1000}
                rows={4}
                className="min-h-28 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
              />
              <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">Optional · up to 1,000 characters.</p>
            </div>
          </div>
        </SectionPanel>

        {error ? <OperationNotice tone="error">{error}</OperationNotice> : null}

        <div className="rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-3 shadow-[var(--tl-shadow-md)]">
          <FieldActionButton
            type="submit"
            fieldSize="major"
            fullWidth
            busy={saving}
            className="min-h-14"
          >
            <Save aria-hidden="true" className="size-5" />
            Save component
          </FieldActionButton>
        </div>
      </form>
      {discardDialog}
    </div>
  );
}
