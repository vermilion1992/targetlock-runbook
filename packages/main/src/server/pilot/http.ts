import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  PilotConfigurationError,
  type SecurePilotEnvironment,
} from "./environment";
import { PilotAuthorizationError } from "./permissions";
import {
  PilotAuthenticationError,
  PilotConflictError,
  PilotDeviceRequiredError,
  PilotPasswordChangeRequiredError,
} from "./services";

export class PilotCsrfError extends Error {
  constructor() {
    super("The request origin could not be verified.");
    this.name = "PilotCsrfError";
  }
}

export class PilotRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many attempts. Try again later.");
    this.name = "PilotRateLimitError";
  }
}

export function assertSameOrigin(
  request: Request,
  environment: SecurePilotEnvironment,
): void {
  const origin = request.headers.get("origin");
  if (origin !== environment.appOrigin) throw new PilotCsrfError();
}

export function getClientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function readBoundedJson(
  request: Request,
  maxBytes = 131_072,
): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new PilotConflictError(
      "The request body is too large.",
      "PAYLOAD_TOO_LARGE",
    );
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new PilotConflictError(
      "The request body is too large.",
      "PAYLOAD_TOO_LARGE",
    );
  }
  return JSON.parse(text) as unknown;
}

export function secureJson(
  body: unknown,
  init: { readonly status?: number; readonly headers?: HeadersInit } = {},
) {
  const response = NextResponse.json(body, {
    status: init.status,
    headers: init.headers,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export function apiErrorResponse(error: unknown): NextResponse {
  const requestId = randomUUID();
  if (error instanceof ZodError) {
    return secureJson(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "The request body is invalid.",
          requestId,
        },
      },
      { status: 400 },
    );
  }
  if (
    error instanceof PilotAuthenticationError ||
    (error instanceof Error &&
      error.message === "PILOT_AUTHENTICATION_REQUIRED")
  ) {
    return secureJson(
      {
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message:
            error instanceof PilotAuthenticationError
              ? error.message
              : "Sign in to continue.",
          requestId,
        },
      },
      { status: 401 },
    );
  }
  if (error instanceof PilotAuthorizationError) {
    return secureJson(
      {
        error: {
          code: "FORBIDDEN",
          message: error.message,
          requestId,
        },
      },
      { status: 403 },
    );
  }
  if (error instanceof PilotPasswordChangeRequiredError) {
    return secureJson(
      {
        error: {
          code: "PASSWORD_CHANGE_REQUIRED",
          message: error.message,
          requestId,
        },
      },
      { status: 403 },
    );
  }
  if (error instanceof PilotCsrfError) {
    return secureJson(
      {
        error: {
          code: "INVALID_ORIGIN",
          message: error.message,
          requestId,
        },
      },
      { status: 403 },
    );
  }
  if (error instanceof PilotRateLimitError) {
    return secureJson(
      {
        error: {
          code: "RATE_LIMITED",
          message: error.message,
          requestId,
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(error.retryAfterSeconds) },
      },
    );
  }
  if (error instanceof PilotDeviceRequiredError) {
    return secureJson(
      {
        error: {
          code: "REGISTERED_DEVICE_REQUIRED",
          message: error.message,
          requestId,
        },
      },
      { status: 409 },
    );
  }
  if (error instanceof PilotConflictError) {
    return secureJson(
      {
        error: {
          code: error.code,
          message: error.message,
          lease: error.lease,
          requestId,
        },
      },
      { status: 409 },
    );
  }
  if (error instanceof PilotConfigurationError) {
    return secureJson(
      {
        error: {
          code: "SERVICE_NOT_CONFIGURED",
          message: "The secure pilot service is not configured.",
          requestId,
        },
      },
      { status: 503 },
    );
  }

  console.error("Pilot request failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return secureJson(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        requestId,
      },
    },
    { status: 500 },
  );
}
