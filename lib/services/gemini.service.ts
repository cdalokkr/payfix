import dotenv from "dotenv";
dotenv.config();

export interface GeminiFileContext {
  path: string;
  content: string;
}

export interface GeminiGenerateOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinking?: boolean;
}

export interface GeminiGenerateResult {
  text: string;
  model: string;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

export const GEMINI_DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-4-hydrogen";

/**
 * Direct Google AI Studio Gemini API content generation
 */
export async function generateGeminiContent(
  prompt: string,
  contextFiles: GeminiFileContext[] = [],
  options: GeminiGenerateOptions = {}
): Promise<GeminiGenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please check your .env or .env.local file.");
  }

  const model = options.model || GEMINI_DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let fullPrompt = "";
  if (contextFiles.length > 0) {
    fullPrompt += "--- CODEBASE CONTEXT FILES ---\n";
    for (const file of contextFiles) {
      fullPrompt += `\n[FILE: ${file.path}]\n\`\`\`\n${file.content}\n\`\`\`\n`;
    }
    fullPrompt += "--- END CODEBASE CONTEXT FILES ---\n\n";
  }
  fullPrompt += prompt;

  const requestBody: any = {
    contents: [
      {
        role: "user",
        parts: [{ text: fullPrompt }],
      },
    ],
  };

  if (options.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  const generationConfig: any = {};
  if (typeof options.temperature === "number") {
    generationConfig.temperature = options.temperature;
  }
  if (typeof options.maxOutputTokens === "number") {
    generationConfig.maxOutputTokens = options.maxOutputTokens;
  }
  if (Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google AI Studio Gemini API error [${res.status}]: ${errorBody}`);
  }

  const data = (await res.json()) as any;
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts.map((p: any) => p.text || "").join("\n");

  return {
    text: text || "No text response generated.",
    model: data.modelVersion || model,
    usage: {
      promptTokenCount: data.usageMetadata?.promptTokenCount,
      candidatesTokenCount: data.usageMetadata?.candidatesTokenCount,
      totalTokenCount: data.usageMetadata?.totalTokenCount,
      thoughtsTokenCount: data.usageMetadata?.thoughtsTokenCount,
    },
  };
}
