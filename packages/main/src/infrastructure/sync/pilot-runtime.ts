export type BrowserRuntimeMode = "unknown" | "demo" | "pilot";

export interface PilotBrowserRuntimeContext {
  readonly mode: "pilot";
  readonly organisationId: string;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly role: "COMPANY_ADMIN" | "SUPERVISOR" | "DRILLER";
  readonly device: {
    readonly id: string;
    readonly projectRef: string | null;
    readonly rigRef: string | null;
  } | null;
  readonly sessionExpiresAt: string;
}

let runtimeMode: BrowserRuntimeMode = "unknown";
let pilotContext: PilotBrowserRuntimeContext | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function configureDemoBrowserRuntime(): void {
  runtimeMode = "demo";
  pilotContext = null;
  emit();
}

export function configurePilotBrowserRuntime(
  context: PilotBrowserRuntimeContext | null,
): void {
  runtimeMode = "pilot";
  pilotContext = context;
  emit();
}

export function getBrowserRuntimeMode(): BrowserRuntimeMode {
  return runtimeMode;
}

export function getPilotBrowserRuntimeContext(): PilotBrowserRuntimeContext | null {
  return pilotContext;
}

export function subscribeToPilotBrowserRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
