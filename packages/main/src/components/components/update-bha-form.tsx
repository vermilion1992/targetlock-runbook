"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  createBrowserRunbookServices,
  recordBottomHoleAssemblySetup,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetreInput } from "@/components/field/metre-input";
import { MetricDisplay } from "@/components/field/metric-display";
import { SectionPanel } from "@/components/field/section-panel";
import { StatePanel } from "@/components/field/state-panel";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { useDiscardLeaveGuard } from "@/components/navigation/discard-leave-guard";
import { cancelBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { Input } from "@/components/ui/input";
import {
  BARREL_STYLES,
  REAMER_STYLES,
  calculateBaseRodString,
  decimetresToMetres,
  formatBarrelStyle,
  formatMetres,
  formatReamerStyle,
  isBarrelStyle,
  isReamerStyle,
  parseMetreInput,
  type BarrelStyle,
  type Decimetres,
  type ReamerStyle,
} from "@/domain";
import { useOperatorSession } from "@/components/session";

function metreInput(value: Decimetres): string {
  return decimetresToMetres(value).toFixed(1);
}

function operationId(): string {
  return `bha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
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

export function UpdateBhaForm({ holeId }: { holeId: string }) {
  const router = useRouter();
  const { session, pilot } = useOperatorSession();
  const identity = useRef({
    operationId: operationId(),
    effectiveAt: new Date().toISOString(),
  });
  const [assemblyLength, setAssemblyLength] = useState("");
  const [constantStickUp, setConstantStickUp] = useState("");
  const [bitStyle, setBitStyle] = useState("");
  const [bitSerial, setBitSerial] = useState("");
  const [frontReamerStyle, setFrontReamerStyle] = useState<ReamerStyle | "">(
    "",
  );
  const [frontReamerSerial, setFrontReamerSerial] = useState("");
  const [barrelStyle, setBarrelStyle] = useState<BarrelStyle | "">("");
  const [barrelSerial, setBarrelSerial] = useState("");
  const [rearReamerStyle, setRearReamerStyle] = useState<ReamerStyle | "">(
    "",
  );
  const [rearReamerSerial, setRearReamerSerial] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasExistingSetup, setHasExistingSetup] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialog: discardDialog } = useDiscardLeaveGuard(isDirty);
  const parentHref = runbookRoutes.currentHole(holeId);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const services = createBrowserRunbookServices();
      if (services === null) {
        if (active) {
          setMessage("Browser storage is unavailable.");
          setLoading(false);
        }
        return;
      }
      const setup = await services.bhaSetups.getCurrent(holeId);
      if (!active) return;
      if (setup) {
        setHasExistingSetup(true);
        setAssemblyLength(metreInput(setup.bottomHoleAssemblyLengthDm));
        setConstantStickUp(metreInput(setup.constantStickUpDm));
        setBitStyle(setup.bitStyle ?? "");
        setBitSerial(setup.bitSerialNumber ?? "");
        setFrontReamerStyle(setup.frontReamerStyle ?? "");
        setFrontReamerSerial(setup.frontReamerSerialNumber ?? "");
        setBarrelStyle(setup.barrelStyle ?? "");
        setBarrelSerial(setup.barrelSerialNumber ?? "");
        setRearReamerStyle(setup.rearReamerStyle ?? "");
        setRearReamerSerial(setup.rearReamerSerialNumber ?? "");
      }
      setLoading(false);
    };
    void load().catch(() => {
      if (active) {
        setMessage("Bottom-hole assembly settings could not be loaded.");
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [holeId]);

  const parsedAssembly = useMemo(
    () => parseMetreInput(assemblyLength),
    [assemblyLength],
  );
  const parsedStickUp = useMemo(
    () => parseMetreInput(constantStickUp),
    [constantStickUp],
  );
  const baseRodString =
    parsedAssembly.ok &&
    parsedStickUp.ok &&
    parsedStickUp.value <= parsedAssembly.value
      ? calculateBaseRodString(parsedAssembly.value, parsedStickUp.value)
      : null;

  if (!loading && pilot?.serverRole === "DRILLER" && hasExistingSetup) {
    return (
      <StatePanel
        state="empty"
        title="Supervisor approval required"
        description="Drillers can record the initial BHA for an assigned Draft hole. Later BHA or constant stick-up changes require a Supervisor and an audited reason."
      />
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!parsedAssembly.ok || !parsedStickUp.ok || baseRodString === null) {
      setMessage(
        "Enter valid 0.1 m measurements. Constant stick-up cannot exceed the assembly length.",
      );
      return;
    }
    if (hasExistingSetup && !reason.trim()) {
      setMessage("Add a reason for the configuration change.");
      return;
    }
    const services = createBrowserRunbookServices();
    if (services === null) {
      setMessage("Browser storage is unavailable.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await recordBottomHoleAssemblySetup(
        {
          operationId: identity.current.operationId,
          holeId,
          effectiveAt: identity.current.effectiveAt,
          bottomHoleAssemblyLengthDm: parsedAssembly.value,
          constantStickUpDm: parsedStickUp.value,
          bitStyle,
          bitSerialNumber: bitSerial,
          frontReamerStyle: frontReamerStyle || undefined,
          frontReamerSerialNumber: frontReamerSerial,
          barrelStyle: barrelStyle || undefined,
          barrelSerialNumber: barrelSerial,
          rearReamerStyle: rearReamerStyle || undefined,
          rearReamerSerialNumber: rearReamerSerial,
          reason: hasExistingSetup
            ? reason.trim()
            : "Initial drilling setup",
          recordedByUserId: session?.operator.localId ?? "local-operator",
          recordedByNameSnapshot:
            session?.operator.displayName ?? "Local operator",
        },
        services,
      );
      setIsDirty(false);
      router.push(`${parentHref}?notice=bha-updated`);
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Bottom-hole assembly could not be saved.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <StagePageHeader
        eyebrow="Components"
        title={hasExistingSetup ? "Update BHA" : "Initial BHA setup"}
        description={
          hasExistingSetup
            ? "Update assembly measurements or BHA components."
            : "Enter the full BHA length and constant stick-up required before drilling."
        }
        backTarget={cancelBackTarget(parentHref, { onNavigate: requestLeave })}
      />

      {message ? (
        <p role="alert" className="font-semibold text-[var(--tl-danger)]">
          {message}
        </p>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        onChange={() => setIsDirty(true)}
        className="space-y-5"
      >
        <SectionPanel
          title="Assembly measurements"
          description="Base R/S = full BHA length − constant stick-up."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <MetreInput
              label="Full BHA length"
              value={assemblyLength}
              onValueChange={(value) => {
                setAssemblyLength(value);
                setIsDirty(true);
              }}
              min={0.1}
              required
              disabled={loading}
            />
            <MetreInput
              label="Constant stick-up"
              value={constantStickUp}
              onValueChange={(value) => {
                setConstantStickUp(value);
                setIsDirty(true);
              }}
              min={0}
              required
              disabled={loading}
            />
            <MetricDisplay
              label="Base rod string"
              value={baseRodString ? formatMetres(baseRodString) : "—"}
              supportingText="Before drill rods"
              emphasis="strong"
            />
          </div>
        </SectionPanel>

        <SectionPanel title="BHA components">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="bit-style">Bit style / type</FieldLabel>
              <Input
                id="bit-style"
                value={bitStyle}
                onChange={(event) => setBitStyle(event.target.value)}
                maxLength={100}
                placeholder="e.g. impregnated, surface-set"
                className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
                disabled={loading}
              />
            </div>
            <div>
              <FieldLabel htmlFor="bit-serial">Bit serial number</FieldLabel>
              <Input
                id="bit-serial"
                value={bitSerial}
                onChange={(event) => setBitSerial(event.target.value)}
                maxLength={100}
                autoComplete="off"
                className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
                disabled={loading}
              />
            </div>

            <div>
              <FieldLabel htmlFor="front-reamer-style">Front reamer style</FieldLabel>
              <select
                id="front-reamer-style"
                value={frontReamerStyle}
                onChange={(event) => {
                  const value = event.target.value;
                  setFrontReamerStyle(
                    value && isReamerStyle(value) ? value : "",
                  );
                }}
                className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
                disabled={loading}
              >
                <option value="">Not set</option>
                {REAMER_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {formatReamerStyle(style)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="front-reamer-serial">
                Front reamer serial number
              </FieldLabel>
              <Input
                id="front-reamer-serial"
                value={frontReamerSerial}
                onChange={(event) => setFrontReamerSerial(event.target.value)}
                maxLength={100}
                autoComplete="off"
                className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
                disabled={loading}
              />
            </div>

            <div>
              <FieldLabel htmlFor="barrel-style">Barrel style</FieldLabel>
              <select
                id="barrel-style"
                value={barrelStyle}
                onChange={(event) => {
                  const value = event.target.value;
                  setBarrelStyle(value && isBarrelStyle(value) ? value : "");
                }}
                className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
                disabled={loading}
              >
                <option value="">Not set</option>
                {BARREL_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {formatBarrelStyle(style)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="barrel-serial">Barrel serial number</FieldLabel>
              <Input
                id="barrel-serial"
                value={barrelSerial}
                onChange={(event) => setBarrelSerial(event.target.value)}
                maxLength={100}
                autoComplete="off"
                className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
                disabled={loading}
              />
            </div>

            <div>
              <FieldLabel htmlFor="rear-reamer-style">Rear reamer style</FieldLabel>
              <select
                id="rear-reamer-style"
                value={rearReamerStyle}
                onChange={(event) => {
                  const value = event.target.value;
                  setRearReamerStyle(
                    value && isReamerStyle(value) ? value : "",
                  );
                }}
                className="min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3 text-base"
                disabled={loading}
              >
                <option value="">Not set</option>
                {REAMER_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {formatReamerStyle(style)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="rear-reamer-serial">
                Rear reamer serial number
              </FieldLabel>
              <Input
                id="rear-reamer-serial"
                value={rearReamerSerial}
                onChange={(event) => setRearReamerSerial(event.target.value)}
                maxLength={100}
                autoComplete="off"
                className="h-11 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-base"
                disabled={loading}
              />
            </div>
          </div>
        </SectionPanel>

        {hasExistingSetup ? (
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">
              Reason for change
              <span className="ml-1 text-[var(--tl-danger)]">*</span>
            </span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              placeholder="Why is this setup changing?"
              disabled={loading}
            />
          </label>
        ) : null}

        <FieldActionButton
          type="submit"
          busy={saving}
          disabled={loading}
          fieldSize="major"
          fullWidth
        >
          <Save aria-hidden="true" className="size-5" />
          {hasExistingSetup ? "Save BHA changes" : "Save initial setup"}
        </FieldActionButton>
      </form>

      {discardDialog}
    </div>
  );
}
