import { describe, expect, it } from "vitest";

import { GET } from "./route";

function request(file?: string): Request {
  const url = new URL("http://localhost/api/code");
  if (file !== undefined) {
    url.searchParams.set("file", file);
  }
  return new Request(url);
}

describe("code preview API", () => {
  it("rejects missing and out-of-scope file paths", async () => {
    expect((await GET(request())).status).toBe(400);
    expect((await GET(request("../../package.json"))).status).toBe(403);
    expect(
      (
        await GET(
          request("src/app/components/charts/../../../../../../.env"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await GET(
          request("src/app/components/charts/ApexCharts/../../../../layout.tsx"),
        )
      ).status,
    ).toBe(403);
  });

  it("serves only supported files beneath the chart preview directory", async () => {
    const response = await GET(
      request(
        "src/app/components/charts/shadcn/area/code/StepCode.tsx",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toContain("A step area chart");
  });
});
