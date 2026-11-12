import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { getRespanGatewayClient } from "../lib/services/respan-gateway.service";

async function main() {
  const args = process.argv.slice(2);
  let model = process.env.RESPAN_MODEL || "gemini-4-carbon";
  let targetFile: string | null = null;
  let customPrompt = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && args[i + 1]) {
      model = args[++i];
    } else if (args[i] === "--file" && args[i + 1]) {
      targetFile = args[++i];
    } else {
      customPrompt += (customPrompt ? " " : "") + args[i];
    }
  }

  let codeContext = "";
  if (targetFile) {
    const fullPath = path.resolve(process.cwd(), targetFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: File not found: ${targetFile}`);
      process.exit(1);
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    codeContext = `\n\n--- FILE: ${targetFile} ---\n${content}\n--- END FILE ---`;
  }

  const prompt = customPrompt || (targetFile ? `Review this file and suggest high-impact improvements for architecture, performance, security, and edge-case handling.` : `Provide a high-level architectural assessment of a multi-tenant biometric attendance and payroll SaaS.`);

  console.log(`\n======================================================`);
  console.log(`🤖 PayFix On-Demand Coding Advisor (Respan Gateway)`);
  console.log(`Model: ${model}`);
  if (targetFile) console.log(`Target File: ${targetFile}`);
  console.log(`======================================================\n`);
  console.log(`Prompt: "${prompt}"\n`);
  console.log(`Querying Respan Gateway...`);

  try {
    const client = getRespanGatewayClient();
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are a Principal Software Architect and Senior Code Advisor auditing the PayFix multi-tenant biometric attendance and payroll SaaS. Provide actionable, prioritized, concrete improvement plans.",
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
    console.log(`\nTip: If 'gemini-4-carbon:free' is paused due to high demand, use --model to specify another model or add credits in the Respan billing portal.\n`);
  }
}

main();
