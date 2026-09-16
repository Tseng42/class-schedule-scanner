import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Messages } from "@anthropic-ai/sdk/resources/index";
import { extractionResultSchema, type ExtractionResult } from "../../schema/extraction";
import { getApiKey } from "./apiKey";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TASK_INSTRUCTION } from "./prompts";
import type { ScheduleExtractor, UploadedFileKind } from "./ScheduleExtractor";
import { MissingApiKeyError, RefusalError } from "./errors";

const MODEL = "claude-sonnet-5";

function getClient(): Anthropic {
  const apiKey = getApiKey();
  if (!apiKey) throw new MissingApiKeyError();
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function buildContentBlock(
  base64Data: string,
  kind: UploadedFileKind,
  mimeType: string,
): Messages.ContentBlockParam {
  if (kind === "pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64Data },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: base64Data,
    },
  };
}

export const claudeVisionExtractor: ScheduleExtractor = {
  async extract(base64Data, kind, mimeType) {
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: EXTRACTION_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(extractionResultSchema) },
      messages: [
        {
          role: "user",
          content: [
            buildContentBlock(base64Data, kind, mimeType),
            { type: "text", text: EXTRACTION_TASK_INSTRUCTION },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new RefusalError();
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("模型沒有回傳可解析的文字內容");
    }

    const parsed: unknown = JSON.parse(textBlock.text);
    return extractionResultSchema.parse(parsed) satisfies ExtractionResult;
  },
};
