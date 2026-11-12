import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { generateGeminiContent } from "../lib/services/gemini.service";
import { getRespanGatewayClient } from "../lib/services/respan-gateway.service";

async function main() {
  const args = process.argv.slice(2);
  let model = process.env.GEMINI_MODEL || "gemini-4-hydrogen";
  let provider = "google"; // "google" | "respan"
  let targetFile: string | null = null;
  let customPrompt = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && args[i + 1]) {
      model = args[++i];
    } else if (args[i] === "--provider" && args[i + 1]) {
      provider = args[++i];
    } else if (args[i] === "--file" && args[i + 1]) {
      targetFile = args[++i];
    } else {
      customPrompt += (customPrompt ? " " : "") + args[i];
    }
  }

  let codeFiles: Array<{ path: string; content: string }> = [];
  if (targetFile) {
    const fullPath = path.resolve(process.cwd(), targetFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: File not found: ${targetFile}`);
      process.exit(1);
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    codeFiles.push({ path: targetFile, content });
  }

  const prompt =
    customPrompt ||
    (targetFile
      ? `Review this file and suggest high-impact improvements for architecture, performance, security, and edge-case handling.`
      : `Provide a high-level architectural assessment of the PayFix multi-tenant biometric attendance and payroll SaaS.`);

  console.log(`\n======================================================`);
  console.log(`🤖 PayFix On-Demand Coding Advisor (Google AI Studio)`);
  console.log(`Provider: ${provider.toUpperCase()}`);
  console.log(`Model:    ${model}`);
  if (targetFile) console.log(`Target:   ${targetFile}`);
  console.log(`======================================================\n`);
  console.log(`Prompt: "${prompt}"\n`);

  if (provider === "google") {
    console.log(`Querying Google AI Studio Gemini API (${model})...`);
    try {
      const response = await generateGeminiContent(prompt, codeFiles, {
        model,
        systemInstruction:
          "You are a Principal Software Architect and Senior Security/Code Advisor auditing the PayFix multi-tenant biometric attendance and payroll SaaS. Provide actionable, prioritized, concrete improvement plans with exact code suggestions where appropriate.",
      });

      console.log(`\n--- Advisor Response (${response.model}) ---\n`);
      console.log(response.text);
      console.log(`\n--------------------------------------------\n`);
      if (response.usage) {
        console.log(`Tokens: Prompt: ${response.usage.promptTokenCount ?? "N/A"} | Reasoning: ${response.usage.thoughtsTokenCount ?? "N/A"} | Output: ${response.usage.candidatesTokenCount ?? "N/A"} | Total: ${response.usage.totalTokenCount ?? "N/A"}`);
      }
    } catch (err: any) {
      console.error(`\n❌ Error communicating with Google AI Studio:`);
      console.error(err?.message || err);
    }
  } else {
    console.log(`Querying Respan Gateway (${model})...`);
    try {
      const client = getRespanGatewayClient();
      const codeContext = codeFiles.length > 0 ? `\n\n--- FILE: ${codeFiles[0].path} ---\n${codeFiles[0].content}\n--- END FILE ---` : "";
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a Principal Software Architect and Senior Code Advisor auditing the PayFix multi-tenant biometric attendance and payroll SaaS. Provide actionable, prioritized, concrete improvement plans.",
          },
          {
            role: "user",
            content: `${prompt}${codeContext}`,
          },
        ],
      });

      const reply = response.choices[0]?.message?.content ?? "No response received.";
      console.log(`\n--- Advisor Response ---\n`);
      console.log(reply);
      console.log(`\n------------------------\n`);
    } catch (err: any) {
      console.error(`\n❌ Error communicating with Respan Gateway:`);
      console.error(err?.message || err);
    }
  }
}

main();
