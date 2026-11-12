import OpenAI from "openai";

/**
 * Respan Gateway Client
 * Documentation: https://www.respan.ai/docs/ai-gateway/quickstart.md
 * Exact wiring matching Respan Playground "View Code"
 */
export function getRespanGatewayClient() {
  const apiKey = process.env.RESPAN_API_KEY;
  if (!apiKey) {
    throw new Error("RESPAN_API_KEY is not defined. Please set RESPAN_API_KEY in .env");
  }

  return new OpenAI({
    baseURL: process.env.RESPAN_BASE_URL || "https://gateway.respan.ai/v1",
    apiKey,
  });
}

export const RESPAN_DEFAULT_MODEL = "gemini-4-carbon";

/**
 * Stream completion via Respan Gateway (matching View Code snippet)
 */
export async function streamRespanCompletion(
  prompt: string,
  onChunk: (text: string) => void,
  model = RESPAN_DEFAULT_MODEL
) {
  const client = getRespanGatewayClient();
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let fullText = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) {
      fullText += text;
      onChunk(text);
    }
  }

  return fullText;
}

/**
 * Helper to execute a completion call via Respan Gateway
 */
export async function sendRespanCompletion(prompt: string, model = RESPAN_DEFAULT_MODEL) {
  let output = "";
  await streamRespanCompletion(prompt, (chunk) => {
    output += chunk;
  }, model);
  return output;
}
