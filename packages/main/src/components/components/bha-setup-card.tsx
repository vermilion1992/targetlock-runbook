"use client";

import { Save, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createBrowserRunbookServices,
  getCurrentHoleState,
} from "@/application/runbook";
import { FieldActionButton } from "@/components/field/field-action-button";
import { MetreInput } from "@/components/field/metre-input";
import { MetricDisplay } from "@/components/field/metric-display";
import {
  calculateBaseRodString,
  decimetresToMetres,
  formatMetres,
  parseMetreInput,
  type Decimetres,
} from "@/domain";

interface ActiveSerials {
  readonly bit: string | null;
  readonly reamer: string | null;
}

function metreInput(value: Decimetres): string {
  return decimetresToMetres(value).toFixed(1);
}

function operationId(): string {
  return `bha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function BhaSetupCard({ holeId }: { holeId: string }) {
  const [assemblyLength, setAssemblyLength] = useState("");
  const [constantStickUp, setConstantStickUp] = useState("");
  const [barrelSerial, setBarrelSerial] = useState("");
  const [innerTubeSerial, setInnerTubeSerial] = useState("");
  const [overshotSerial, setOvershotSerial] = useState("");
  const [reason, setReason] = useState("");
  const [activeSerials, setActiveSerials] = useState<ActiveSerials>({
    bit: null,
    reamer: null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actor, setActor] = useState({
    id: "local-operator",
    name: "Local operator",
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      const services = createBrowserRunbookServices();
      if (services === null) return;
      const [setup, bitAssignment, reamerAssignment, state] =
        await Promise.all([
          services.bhaSetups.getCurrent(holeId),
          services.componentAssignments.getActive(holeId, "BIT"),
          services.componentAssignments.getActive(holeId, "REAMER"),
          getCurrentHoleState(holeId, services.currentState),
        ]);
      const [bit, reamer] = await Promise.all([
        bitAssignment
          ? services.components.getById(bitAssignment.componentId)
          : Promise.resolve(null),
        reamerAssignment
          ? services.components.getById(reamerAssignment.componentId)
          : Promise.resolve(null),
      ]);
      if (!active) return;
      if (setup) {
        setAssemblyLength(metreInput(setup.bottomHoleAssemblyLengthDm));
        setConstantStickUp(metreInput(setup.constantStickUpDm));
        setBarrelSerial(setup.barrelSerialNumber ?? "");
        setInnerTubeSerial(setup.innerTubeSerialNumber ?? "");
        setOvershotSerial(setup.overshotSerialNumber ?? "");
      }
      setActiveSerials({
        bit: bit?.serialNumber ?? null,
        reamer: reamer?.serialNumber ?? null,
      });
      if (state.activeShift) {
        setActor({
          id: state.activeShift.primaryDrillerId,
          name: state.activeShift.primaryDrillerNameSnapshot,
        });
      }
    };
    void load().catch(() => {
      if (active) setMessage("Bottom-hole assembly settings could not be loaded.");
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

  const handleSave = async () => {
    if (!parsedAssembly.ok || !parsedStickUp.ok || baseRodString === null) {
      setMessage(
        "Enter valid 0.1 m measurements. Constant stick-up cannot exceed the assembly length.",
      );
      return;
    }
    if (!reason.trim()) {
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
      await services.bhaSetups.save({
        operationId: operationId(),
        holeId,
        effectiveAt: new Date().toISOString(),
        bottomHoleAssemblyLengthDm: parsedAssembly.value,
        constantStickUpDm: parsedStickUp.value,
        barrelSerialNumber: barrelSerial,
        innerTubeSerialNumber: innerTubeSerial,
        overshotSerialNumber: overshotSerial,
        reason: reason.trim(),
        recordedByUserId: actor.id,
        recordedByNameSnapshot: actor.name,
      });
      setReason("");
      setMessage(
        "Bottom-hole assembly saved. The new base rod-string length applies to the next run.",
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Bottom-hole assembly could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="bha-setup-heading"
      className="space-y-5 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)] md:p-5"
    >
      <div className="flex items-start gap-3">
        <Settings2
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--tl-primary)]"
        />
        <div>
          <h2 id="bha-setup-heading" className="text-lg font-bold">
            Assembly measurements and serials
          </h2>
          <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
            Constant stick-up is adjusted here. Base R/S = assembly length −
            constant stick-up.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetreInput
          label="Complete BHA length"
          value={assemblyLength}
          onValueChange={setAssemblyLength}
          min={0.1}
          required
        />
        <MetreInput
          label="Constant stick-up"
          value={constantStickUp}
          onValueChange={setConstantStickUp}
          min={0}
          required
        />
        <MetricDisplay
          label="Base rod string"
          value={baseRodString ? formatMetres(baseRodString) : "—"}
          supportingText="Before drill rods"
          emphasis="strong"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Barrel serial number", barrelSerial, setBarrelSerial],
          ["Inner tube serial number", innerTubeSerial, setInnerTubeSerial],
          ["Overshot serial number", overshotSerial, setOvershotSerial],
        ].map(([label, value, setter]) => (
          <label key={label as string} className="space-y-1 text-sm">
            <span className="font-semibold">{label as string}</span>
            <input
              value={value as string}
              onChange={(event) =>
                (setter as (next: string) => void)(event.target.value)
              }
              className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
              placeholder="Optional"
            />
          </label>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-[var(--tl-surface-sunken)] p-3">
          <dt className="text-[var(--tl-ink-muted)]">Active bit</dt>
          <dd className="mt-1 font-bold">{activeSerials.bit ?? "Not assigned"}</dd>
        </div>
        <div className="rounded-md bg-[var(--tl-surface-sunken)] p-3">
          <dt className="text-[var(--tl-ink-muted)]">Active reamer</dt>
          <dd className="mt-1 font-bold">
            {activeSerials.reamer ?? "Not assigned"}
          </dd>
        </div>
      </dl>

      <label className="block space-y-1 text-sm">
        <span className="font-semibold">
          Reason for measurement or configuration change
        </span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-11 w-full rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] px-3"
          placeholder="Required when saving"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <FieldActionButton
          type="button"
          busy={saving}
          onClick={() => void handleSave()}
        >
          <Save aria-hidden="true" className="size-5" />
          Save BHA setup
        </FieldActionButton>
        {message ? (
          <p role="status" className="text-sm font-semibold">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
