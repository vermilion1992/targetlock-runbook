import { z } from "zod";

export const MAX_GEMINI_MESSAGE_LENGTH = 4_000;
export const INVALID_GEMINI_MESSAGE_ERROR =
  "Message must be a non-empty string no longer than 4,000 characters.";

const geminiRequestSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1)
      .max(MAX_GEMINI_MESSAGE_LENGTH),
  })
  .strict();

export type GeminiRequest =
  | { success: true; message: string }
  | { success: false; error: string };

export function parseGeminiRequest(input: unknown): GeminiRequest {
  const result = geminiRequestSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      error: INVALID_GEMINI_MESSAGE_ERROR,
    };
  }

  return {
    success: true,
    message: result.data.message,
  };
}
