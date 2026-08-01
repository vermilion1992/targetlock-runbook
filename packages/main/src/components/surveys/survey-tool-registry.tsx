"use client";

import { Plus, Wrench } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import {
  correctSurveyTool,
  createBrowserRunbookServices,
  createSurveyTool,
} from "@/application/runbook";
import { StatusPill } from "@/components/field/status-pill";
import { StagePageHeader } from "@/components/holes/stage-page-header";
import { namedBackTarget } from "@/components/navigation/runbook-page-back";
import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { resolveOperationActor } from "@/components/session/operation-actor";
import { useOperatorSession } from "@/components/session";
import type { NorthReference, SurveyTool } from "@/domain";

export function SurveyToolRegistry({ holeId }: { holeId: string }) {
  const { runtimeMode, session, pilot } = useOperatorSession();
  const [tools, setTools] = useState<readonly SurveyTool[]>([]);
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [reference, setReference] =
    useState<NorthReference>("NOT_SPECIFIED");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    const services = createBrowserRunbookServices();
    if (services === null) throw new Error("Browser storage is unavailable.");
    setTools(await services.surveyTools.listAll());
  }

  useEffect(() => {
    void Promise.resolve()
      .then(reload)
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Survey tools could not be loaded.",
        ),
      );
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const services = createBrowserRunbookServices();
    if (services === null) {
      setError("Browser storage is unavailable.");
      return;
    }
    const operationId = crypto.randomUUID();
    try {
      const actor = resolveOperationActor(runtimeMode, session, pilot, {
        id: "user-driller-hoffman",
        name: "M. Hoffman",
        organisationId: "organisation-briggs",
      });
      await createSurveyTool(
        {
          operationId,
          toolId: `survey-tool-${operationId}`,
          organisationId: actor.organisationId,
          name: name.trim(),
          manufacturer: manufacturer.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serial.trim() || undefined,
          defaultNorthReference: reference,
          createdByUserId: actor.id,
          createdByNameSnapshot: actor.name,
          occurredAt: new Date().toISOString(),
          auditHoleId: holeId,
        },
        services,
      );
      setName("");
      setManufacturer("");
      setModel("");
      setSerial("");
      setNotice("Survey tool saved locally.");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Survey tool could not be saved.");
    }
  }

  async function toggle(tool: SurveyTool) {
    const services = createBrowserRunbookServices();
    if (services === null) return;
    try {
      const actor = resolveOperationActor(runtimeMode, session, pilot, {
        id: "user-driller-hoffman",
        name: "M. Hoffman",
        organisationId: "organisation-briggs",
      });
      await correctSurveyTool(
        {
          operationId: crypto.randomUUID(),
          toolId: tool.localId,
          expectedVersion: tool.version,
          status: tool.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
          userId: actor.id,
          userNameSnapshot: actor.name,
          occurredAt: new Date().toISOString(),
          auditHoleId: holeId,
        },
        services,
      );
      setNotice(
        `${tool.name} marked ${tool.status === "ACTIVE" ? "inactive" : "active"}.`,
      );
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Survey tool could not be updated.");
    }
  }

  return (
    <div className="space-y-5">
      <StagePageHeader
        eyebrow="Surveys"
        title="Survey tools"
        description="A lightweight local registry for tool and serial inheritance. Calibration and maintenance remain outside V1."
        backTarget={namedBackTarget(runbookRoutes.more(holeId), "More")}
      />
      {notice ? <p role="status" aria-live="polite" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-success)] bg-[var(--tl-success-soft)] p-3 font-bold">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-[var(--tl-radius-md)] border border-[var(--tl-danger)] bg-[var(--tl-danger-soft)] p-3 font-bold">{error}</p> : null}
      <section aria-labelledby="tool-list-heading">
        <h2 id="tool-list-heading" className="mb-3 text-lg font-bold">Registered tools</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {tools.map((tool) => (
            <article key={tool.localId} className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{tool.name}</h3>
                  <p className="mt-1 text-sm text-[var(--tl-ink-muted)]">
                    {tool.serialNumber ?? "No serial"} ·{" "}
                    {tool.defaultNorthReference?.replace("_", " ") ?? "No default reference"}
                  </p>
                </div>
                <StatusPill tone={tool.status === "ACTIVE" ? "success" : "neutral"}>{tool.status}</StatusPill>
              </div>
              <button type="button" onClick={() => void toggle(tool)} className="mt-3 min-h-11 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] px-3 font-bold">
                Mark {tool.status === "ACTIVE" ? "inactive" : "active"}
              </button>
            </article>
          ))}
        </div>
      </section>
      <form onSubmit={submit} className="grid gap-4 rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold sm:col-span-2"><Wrench aria-hidden="true" className="size-5" />Add survey tool</h2>
        <label><span className="text-sm font-bold">Name *</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="EZ-TRAC" className="mt-2 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" /></label>
        <label><span className="text-sm font-bold">Serial number</span><input value={serial} onChange={(event) => setSerial(event.target.value)} className="mt-2 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" /></label>
        <label><span className="text-sm font-bold">Manufacturer</span><input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} className="mt-2 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" /></label>
        <label><span className="text-sm font-bold">Model</span><input value={model} onChange={(event) => setModel(event.target.value)} className="mt-2 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3" /></label>
        <label className="sm:col-span-2"><span className="text-sm font-bold">Default north reference</span><select value={reference} onChange={(event) => setReference(event.target.value as NorthReference)} className="mt-2 min-h-11 w-full rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] px-3"><option value="GRID">Grid North</option><option value="MAGNETIC">Magnetic North</option><option value="TRUE">True North</option><option value="NOT_SPECIFIED">Not specified</option></select></label>
        <button type="submit" className="tl-action-primary flex min-h-12 items-center justify-center gap-2 rounded-[var(--tl-radius-md)] px-4 font-bold text-white sm:col-span-2"><Plus aria-hidden="true" className="size-5" />ADD TOOL</button>
      </form>
    </div>
  );
}
