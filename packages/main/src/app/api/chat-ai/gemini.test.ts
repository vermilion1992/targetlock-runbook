import { describe, expect, it, vi } from "vitest";

import { sendMessageToGemini } from "./gemini";

describe("Gemini client helper", () => {
  it("posts the message to the same-origin server route", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ text: "Server-generated answer" }),
    );

    await expect(
      sendMessageToGemini("  Explain this run  ", fetcher as typeof fetch),
    ).resolves.toBe("Server-generated answer");
    expect(fetcher).toHaveBeenCalledWith("/api/chat-ai/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Explain this run" }),
    });
  });

  it("rejects blank messages before making a request", async () => {
    const fetcher = vi.fn();

    await expect(
      sendMessageToGemini("   ", fetcher as typeof fetch),
    ).rejects.toThrow("Enter a message before sending.");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces safe server errors and handles non-JSON failures", async () => {
    const serverError = vi.fn(async () =>
      Response.json(
        { error: "Gemini text generation is not configured." },
        { status: 503 },
      ),
    );
    await expect(
      sendMessageToGemini("hello", serverError as typeof fetch),
    ).rejects.toThrow("Gemini text generation is not configured.");

    const proxyError = vi.fn(async () =>
      new Response("Not Found", { status: 404 }),
    );
    await expect(
      sendMessageToGemini("hello", proxyError as typeof fetch),
    ).rejects.toThrow(
      "Gemini text generation is unavailable (HTTP 404).",
    );
  });
});
