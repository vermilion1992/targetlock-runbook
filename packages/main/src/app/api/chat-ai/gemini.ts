type GeminiResponse = {
  text?: unknown;
  error?: unknown;
};

export async function sendMessageToGemini(
  userMessage: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const message = userMessage.trim();
  if (!message) {
    throw new Error("Enter a message before sending.");
  }

  const response = await fetcher("/api/chat-ai/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  let payload: GeminiResponse | null = null;

  try {
    payload = (await response.json()) as GeminiResponse;
  } catch {
    // A proxy or framework error may return a non-JSON response.
  }

  if (!response.ok) {
    const error =
      typeof payload?.error === "string"
        ? payload.error
        : `Gemini text generation is unavailable (HTTP ${response.status}).`;
    throw new Error(error);
  }

  if (typeof payload?.text !== "string" || payload.text.trim().length === 0) {
    throw new Error("Gemini returned an invalid response.");
  }

  return payload.text;
}
