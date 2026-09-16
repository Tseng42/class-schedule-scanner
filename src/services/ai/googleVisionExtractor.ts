import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { extractionResultSchema, type ExtractionResult } from "../../schema/extraction";
import { getGoogleApiKey } from "./googleApiKey";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TASK_INSTRUCTION } from "./prompts";
import type { ScheduleExtractor } from "./ScheduleExtractor";
import { MissingApiKeyError, RefusalError } from "./errors";

const MODEL = "gemini-3.6-flash";

// Gemini's structured-output schema doesn't accept `additionalProperties` or
// the `$schema` keyword — strip them recursively from what Zod generates.
function toGeminiJsonSchema(schema: z.ZodType): unknown {
  const jsonSchema = z.toJSONSchema(schema);
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const { additionalProperties: _drop1, $schema: _drop2, ...rest } = node as Record<
        string,
        unknown
      >;
      return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, strip(value)]));
    }
    return node;
  };
  return strip(jsonSchema);
}

function getClient(): GoogleGenAI {
  const apiKey = getGoogleApiKey();
  if (!apiKey) throw new MissingApiKeyError();
  return new GoogleGenAI({ apiKey });
}

export const googleVisionExtractor: ScheduleExtractor = {
  async extract(base64Data, _kind, mimeType) {
    const client = getClient();

    const response = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: EXTRACTION_SYSTEM_PROMPT },
            { text: EXTRACTION_TASK_INSTRUCTION },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: toGeminiJsonSchema(extractionResultSchema),
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      throw new RefusalError();
    }

    const text = response.text;
    if (!text) {
      throw new Error("模型沒有回傳可解析的文字內容");
    }

    const parsed: unknown = JSON.parse(text);
    return extractionResultSchema.parse(parsed) satisfies ExtractionResult;
  },
};
