import { describe, expect, it } from "vitest";

import {
  INVALID_GEMINI_MESSAGE_ERROR,
  MAX_GEMINI_MESSAGE_LENGTH,
  parseGeminiRequest,
} from "./request";

describe("Gemini request validation", () => {
  it("accepts and trims a valid message", () => {
    expect(parseGeminiRequest({ message: "  Explain this run  " })).toEqual({
      success: true,
      message: "Explain this run",
    });
  });

  it("rejects missing, blank, non-string, and extra fields", () => {
    for (const input of [
      null,
      {},
      { message: "   " },
      { message: 42 },
      { message: "hello", apiKey: "must-not-be-accepted" },
    ]) {
      expect(parseGeminiRequest(input)).toEqual({
        success: false,
        error: INVALID_GEMINI_MESSAGE_ERROR,
      });
    }
  });

  it("enforces the message length limit", () => {
    expect(
      parseGeminiRequest({ message: "x".repeat(MAX_GEMINI_MESSAGE_LENGTH) })
        .success,
    ).toBe(true);
    expect(
      parseGeminiRequest({
        message: "x".repeat(MAX_GEMINI_MESSAGE_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});
