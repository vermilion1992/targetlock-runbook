import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const geminiMocks = vi.hoisted(() => ({
  apiKeys: [] as string[],
  generateContent: vi.fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    constructor(apiKey: string) {
      geminiMocks.apiKeys.push(apiKey);
    }

    getGenerativeModel() {
      return { generateContent: geminiMocks.generateContent };
    }
  },
}));

import { POST } from "./route";

const originalGeminiApiKey = process.env.GEMINI_API_KEY;
const originalPublicGeminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

function request(body: string): Request {
  return new Request("http://localhost/api/chat-ai/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  geminiMocks.apiKeys.length = 0;
  geminiMocks.generateContent.mockReset();
});

afterEach(() => {
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }

  if (originalPublicGeminiApiKey === undefined) {
    delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = originalPublicGeminiApiKey;
  }
});

describe("Gemini text generation API", () => {
  it("rejects malformed and invalid request bodies", async () => {
    const malformed = await POST(request("{"));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({
      error: "Request body must be valid JSON.",
    });

    const invalid = await POST(request(JSON.stringify({ message: " " })));
    expect(invalid.status).toBe(400);
    expect(geminiMocks.generateContent).not.toHaveBeenCalled();
  });

  it("does not accept the legacy public API key", async () => {
    process.env.NEXT_PUBLIC_GEMINI_API_KEY = "public-key-must-be-ignored";

    const response = await POST(
      request(JSON.stringify({ message: "hello" })),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Gemini text generation is not configured.",
    });
    expect(geminiMocks.apiKeys).toEqual([]);
  });

  it("uses the server-only key and returns generated text", async () => {
    process.env.GEMINI_API_KEY = "server-only-key";
    geminiMocks.generateContent.mockResolvedValue({
      response: Promise.resolve({
        text: () => "Generated on the server",
      }),
    });

    const response = await POST(
      request(JSON.stringify({ message: "hello" })),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: "Generated on the server",
    });
    expect(geminiMocks.apiKeys).toEqual(["server-only-key"]);
    expect(geminiMocks.generateContent).toHaveBeenCalledWith("hello");
  });
});
