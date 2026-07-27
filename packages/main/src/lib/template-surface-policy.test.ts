import { describe, expect, it } from "vitest";

import {
  areTemplateDemosEnabled,
  getTemplateSurfaceDecision,
  isRequiredPublicAsset,
  isTargetLockRoute,
} from "./template-surface-policy";

const production = { NODE_ENV: "production" };

describe("template surface policy", () => {
  it("keeps the inherited template available outside production", () => {
    expect(getTemplateSurfaceDecision("/dashboards/modern", {})).toBe("allow");
    expect(
      getTemplateSurfaceDecision("/api/kanban", { NODE_ENV: "development" }),
    ).toBe("allow");
  });

  it("allows only TargetLock routes in production by default", () => {
    for (const pathname of [
      "/",
      "/sign-in",
      "/start",
      "/holes",
      "/holes/DDH041/current",
      "/projects",
      "/projects/example",
      "/components",
      "/components/new",
      "/components/component-bit-002193",
      "/api/health",
    ]) {
      expect(isTargetLockRoute(pathname)).toBe(true);
      expect(getTemplateSurfaceDecision(pathname, production)).toBe("allow");
    }

    for (const pathname of [
      "/dashboard",
      "/dashboards/modern",
      "/auth/auth1/login",
      "/frontend-pages/about",
      "/apps/chat-ai",
      "/api/chat-ai",
      "/api/code",
      "/components/react-tables/sorting",
      "/components/inventory",
      "/components/not-a-component-id",
      "/holes-example",
      "/holes/completed/current",
      "/holes/Completed",
      "/holes/new/current",
      "/projects-preview",
      "/components-demo",
    ]) {
      expect(getTemplateSurfaceDecision(pathname, production)).toBe(
        "not-found",
      );
    }
  });

  it("keeps required Next and public assets reachable", () => {
    for (const pathname of [
      "/_next/static/chunks/app.js",
      "/_next/image",
      "/images/logos/targetlock-mark.svg",
      "/assets/report.csv",
      "/serwist/sw.js",
      "/favicon.svg",
      "/robots.txt",
    ]) {
      expect(isRequiredPublicAsset(pathname)).toBe(true);
      expect(getTemplateSurfaceDecision(pathname, production)).toBe("allow");
    }
  });

  it("requires an explicit true value to enable demos in production", () => {
    expect(areTemplateDemosEnabled(production)).toBe(false);
    expect(
      areTemplateDemosEnabled({
        ...production,
        ENABLE_TEMPLATE_DEMOS: " true ",
      }),
    ).toBe(true);
    expect(
      getTemplateSurfaceDecision("/api/image-ai", {
        ...production,
        ENABLE_TEMPLATE_DEMOS: "true",
      }),
    ).toBe("allow");
  });
});
