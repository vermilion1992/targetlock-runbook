import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import { parseGeminiRequest } from "./request";

const MODEL_NAME = "gemini-2.0-flash";

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = parseGeminiRequest(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(
      { error: "Gemini text generation is not configured." },
      503,
    );
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(parsed.message);
    const text = (await result.response).text().trim();

    if (!text) {
      return jsonResponse(
        { error: "Gemini did not return a text response." },
        502,
      );
    }

    return jsonResponse({ text }, 200);
  } catch {
    console.error("Gemini text generation request failed.");
    return jsonResponse(
      { error: "Gemini text generation is temporarily unavailable." },
      502,
    );
  }
}
