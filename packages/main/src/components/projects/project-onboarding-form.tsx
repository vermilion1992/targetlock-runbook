"use client";

import { CirclePlus, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { createBrowserRunbookServices } from "@/application/runbook";
import { SectionPanel } from "@/components/field/section-panel";
import {
  LocalPrototypeNotice,
  StagePageHeader,
} from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { Input } from "@/components/ui/input";
import {
  createProjectWithInitialRigInputSchema,
  ProjectDirectoryRepositoryError,
} from "@/infrastructure/projects";
import { useOperatorSession } from "@/components/session";

const inputClassName =
  "h-12 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base";
const secondaryActionClass =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--tl-radius-md)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-5 text-sm font-semibold text-[var(--tl-ink)]";
const primaryActionClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] bg-[var(--tl-primary)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60";

type FieldName =
  | "projectCode"
  | "projectName"
  | "clientName"
  | "location"
  | "rigName"
  | "rigSerialNumber"
  | "rigModel";

type FieldErrors = Partial<Record<FieldName, string>>;

function createLocalId(prefix: string): string {
  const unique =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

function formValue(form: FormData, name: FieldName): string {
  return String(form.get(name) ?? "");
}

function RequiredField({
  id,
  name,
  label,
  placeholder,
  maxLength,
  autoComplete,
  error,
}: {
  id: string;
  name: FieldName;
  label: string;
  placeholder: string;
  maxLength: number;
  autoComplete?: string;
  error?: string;
}) {
  const helpId = `${id}-help`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-bold text-[var(--tl-ink)]"
      >
        {label}
        <span className="ml-1 text-[var(--tl-danger)]" aria-hidden="true">
          *
        </span>
      </label>
      <Input
        id={id}
        name={name}
        required
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? helpId : undefined}
        className={inputClassName}
      />
      {error ? (
        <p
          id={helpId}
          className="mt-1.5 text-sm font-semibold text-[var(--tl-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ProjectOnboardingForm() {
  const router = useRouter();
  const { session } = useOperatorSession();
  const identities = useRef({
    operationId: createLocalId("create-project"),
    projectId: createLocalId("project"),
    rigId: createLocalId("rig"),
    occurredAt: new Date().toISOString(),
  });
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const values = new FormData(event.currentTarget);
    const parsed = createProjectWithInitialRigInputSchema.safeParse({
      ...identities.current,
      projectCode: formValue(values, "projectCode"),
      projectName: formValue(values, "projectName"),
      clientName: formValue(values, "clientName"),
      location: formValue(values, "location"),
      rigName: formValue(values, "rigName"),
      rigSerialNumber: formValue(values, "rigSerialNumber"),
      rigModel: formValue(values, "rigModel"),
      createdByUserId: session?.operator.localId,
      createdByNameSnapshot: session?.operator.displayName,
    });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName | undefined;
        if (field && field in nextErrors === false) {
          nextErrors[field] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      setFormError("Check the required details and try again.");
      return;
    }

    const services = createBrowserRunbookServices();
    if (services === null) {
      setFormError("Browser storage is unavailable. The project was not saved.");
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const { project } =
        await services.projects.createProjectWithInitialRig(parsed.data);
      setIsDirty(false);
      router.push(`/projects/${encodeURIComponent(project.localId)}`);
    } catch (cause) {
      if (cause instanceof ProjectDirectoryRepositoryError) {
        if (cause.code === "DUPLICATE_PROJECT_CODE") {
          setFieldErrors({ projectCode: cause.message });
        } else if (cause.code === "DUPLICATE_RIG_SERIAL") {
          setFieldErrors({ rigSerialNumber: cause.message });
        }
      }
      setFormError(
        cause instanceof Error
          ? cause.message
          : "The project and initial rig could not be saved.",
      );
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6" data-testid="project-onboarding">
      <StagePageHeader
        eyebrow="Project setup"
        title="Create project"
        description="Add the project and its first rig together so the field team can start a hole immediately."
        backTarget={cancelBackTarget("/projects", { onNavigate: requestLeave })}
      />

      <LocalPrototypeNotice />

      <form
        onSubmit={handleSubmit}
        onChange={() => {
          setIsDirty(true);
          setFieldErrors({});
          if (formError) setFormError(null);
        }}
        className="space-y-5"
        noValidate
      >
        <SectionPanel
          title="Project details"
          description="Use the operational project code shown on drilling records and reports."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <RequiredField
              id="project-code"
              name="projectCode"
              label="Project code"
              placeholder="For example, BRG-26-02"
              maxLength={50}
              error={fieldErrors.projectCode}
            />
            <RequiredField
              id="project-name"
              name="projectName"
              label="Project name"
              placeholder="North Ridge extension"
              maxLength={150}
              autoComplete="organization"
              error={fieldErrors.projectName}
            />
            <RequiredField
              id="project-client"
              name="clientName"
              label="Client"
              placeholder="Client organisation"
              maxLength={150}
              autoComplete="organization"
              error={fieldErrors.clientName}
            />
            <RequiredField
              id="project-location"
              name="location"
              label="Location"
              placeholder="Town, region or operating area"
              maxLength={200}
              autoComplete="address-level2"
              error={fieldErrors.location}
            />
          </div>
        </SectionPanel>

        <SectionPanel
          title="Initial rig"
          description="This rig is added as operating and is ready to select when creating the first hole."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <RequiredField
              id="rig-name"
              name="rigName"
              label="Rig name"
              placeholder="For example, Rig 12"
              maxLength={100}
              error={fieldErrors.rigName}
            />
            <RequiredField
              id="rig-serial"
              name="rigSerialNumber"
              label="Rig serial"
              placeholder="Manufacturer serial number"
              maxLength={100}
              error={fieldErrors.rigSerialNumber}
            />
            <div className="sm:col-span-2">
              <RequiredField
                id="rig-model"
                name="rigModel"
                label="Rig model"
                placeholder="For example, Sandvik DE150"
                maxLength={100}
                error={fieldErrors.rigModel}
              />
            </div>
          </div>
        </SectionPanel>

        {formError ? (
          <div
            role="alert"
            className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-surface)] px-4 py-3 text-sm font-semibold text-[var(--tl-danger)]"
          >
            {formError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface-raised)] p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={secondaryActionClass}
            onClick={() => requestLeave("/projects")}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={primaryActionClass}
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <CirclePlus aria-hidden="true" className="size-4" />
            )}
            {saving ? "Creating project…" : "Create project"}
          </button>
        </div>
      </form>
      {discardDialog}
    </div>
  );
}
