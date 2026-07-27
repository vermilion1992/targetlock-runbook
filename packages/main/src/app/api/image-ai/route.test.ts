import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "./route";

const originalGeminiApiKey = process.env.GEMINI_API_KEY;

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
});

describe("image AI mock mode", () => {
  it("returns the next four mock images and wraps at the end", async () => {
    const request = new Request("http://localhost/api/image-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "mock", currentIndex: 10 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      images: [
        "/images/image-ai/leptop3.jpg",
        "/images/image-ai/leptop4.jpg",
        "/images/image-ai/flower1.jpg",
        "/images/image-ai/flower2.jpg",
      ],
      isMock: true,
    });
  });
});
