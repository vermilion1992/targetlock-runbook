import { describe, expect, it } from "vitest";

import { parsePilotLoginInput } from "./pilot-login-input";

describe("parsePilotLoginInput", () => {
  it("normalises valid organisation and email values", () => {
    expect(
      parsePilotLoginInput({
        organisation: "  target-lock  ",
        email: "  Operator@Example.com ",
        password: "safe-password-123",
      }),
    ).toEqual({
      ok: true,
      input: {
        organisation: "target-lock",
        email: "operator@example.com",
        password: "safe-password-123",
      },
    });
  });

  it.each([
    [
      { organisation: "", email: "operator@example.com", password: "safe-password-123" },
      "organisation code",
    ],
    [
      { organisation: "target-lock", email: "operator", password: "safe-password-123" },
      "valid account email",
    ],
    [
      { organisation: "target-lock", email: "operator@example.com", password: "short" },
      "at least 10 characters",
    ],
  ])("returns a field-specific message for invalid values", (input, message) => {
    expect(parsePilotLoginInput(input)).toMatchObject({
      ok: false,
      message: expect.stringContaining(message),
    });
  });
});
