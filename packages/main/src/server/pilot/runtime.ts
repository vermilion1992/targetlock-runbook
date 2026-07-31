import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  readPilotEnvironment,
  type SecurePilotEnvironment,
} from "./environment";
import { shouldBypassPilotAuthForGuest } from "./guest";
import { hasPilotPermission } from "./permissions";
import { PostgresPilotRepository } from "./postgres-repository";
import {
  PilotFoundationService,
  PilotPasswordChangeRequiredError,
} from "./services";
import type {
  PilotPermission,
  PilotRequestContext,
} from "./types";

export const PILOT_SESSION_COOKIE = "__Host-targetlock_session";
export const PILOT_DEVICE_COOKIE = "__Host-targetlock_device";
export const PILOT_GUEST_COOKIE = "__Host-targetlock_guest";
const DEVELOPMENT_SESSION_COOKIE = "targetlock_session";
const DEVELOPMENT_DEVICE_COOKIE = "targetlock_device";
const DEVELOPMENT_GUEST_COOKIE = "targetlock_guest";

declare global {
  var __targetLockPilotService: PilotFoundationService | undefined;
}

export function getCookieNames(environment: SecurePilotEnvironment): {
  readonly session: string;
  readonly device: string;
  readonly guest: string;
} {
  return environment.nodeEnv === "production"
    ? {
        session: PILOT_SESSION_COOKIE,
        device: PILOT_DEVICE_COOKIE,
        guest: PILOT_GUEST_COOKIE,
      }
    : {
        session: DEVELOPMENT_SESSION_COOKIE,
        device: DEVELOPMENT_DEVICE_COOKIE,
        guest: DEVELOPMENT_GUEST_COOKIE,
      };
}

export function getPilotService(
  environment: SecurePilotEnvironment,
): PilotFoundationService {
  globalThis.__targetLockPilotService ??= new PilotFoundationService(
    new PostgresPilotRepository(),
    {
      sessionSecret: environment.sessionSecret,
      sessionTtlSeconds: environment.sessionTtlSeconds,
    },
  );
  return globalThis.__targetLockPilotService;
}

export async function resolvePilotRequestContext(): Promise<
  PilotRequestContext | null
> {
  const environment = readPilotEnvironment();
  if (environment.mode === "demo") return null;
  const cookieStore = await cookies();
  const names = getCookieNames(environment);
  const service = getPilotService(environment);
  const principal = await service.resolvePrincipal(
    cookieStore.get(names.session)?.value ?? null,
  );
  if (principal === null) return null;
  const device = await service.resolveDevice(
    principal,
    cookieStore.get(names.device)?.value ?? null,
  );
  return { principal, device };
}

export async function requirePilotRequestContext(
  options: { readonly allowTemporaryPassword?: boolean } = {},
): Promise<PilotRequestContext> {
  const context = await resolvePilotRequestContext();
  if (context === null) throw new Error("PILOT_AUTHENTICATION_REQUIRED");
  if (
    context.principal.mustChangePassword &&
    !options.allowTemporaryPassword
  ) {
    throw new PilotPasswordChangeRequiredError();
  }
  return context;
}

export async function requirePilotPageSession(
  nextPath: string,
  permission?: PilotPermission,
): Promise<PilotRequestContext | null> {
  const environment = readPilotEnvironment();
  if (environment.mode === "demo") return null;
  const cookieStore = await cookies();
  const names = getCookieNames(environment);
  if (
    shouldBypassPilotAuthForGuest(
      environment,
      cookieStore.get(names.guest)?.value ?? null,
    )
  ) {
    return null;
  }
  const context = await resolvePilotRequestContext();
  if (context === null) {
    const search = new URLSearchParams({ next: nextPath });
    if (cookieStore.has(names.session)) {
      search.set("reason", "session-expired");
    }
    redirect(`/sign-in?${search.toString()}`);
  }
  if (
    context.principal.mustChangePassword &&
    nextPath !== "/pilot-account"
  ) {
    redirect("/pilot-account");
  }
  if (
    permission !== undefined &&
    !hasPilotPermission(context.principal.role, permission)
  ) {
    redirect("/start?access=denied");
  }
  return context;
}

export function pilotCookieOptions(
  environment: SecurePilotEnvironment,
  maxAge: number,
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: environment.nodeEnv === "production",
    path: "/",
    maxAge,
  };
}

export function pilotCookieLifecycle(
  action: "OPERATOR_LOGOUT" | "REMOVE_CURRENT_DEVICE" | "PASSWORD_CHANGED",
): { readonly clearSession: boolean; readonly clearDevice: boolean } {
  if (action === "REMOVE_CURRENT_DEVICE") {
    return { clearSession: false, clearDevice: true };
  }
  return { clearSession: true, clearDevice: false };
}
