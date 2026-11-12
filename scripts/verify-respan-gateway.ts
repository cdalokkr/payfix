import dotenv from "dotenv";
dotenv.config();

import { streamRespanCompletion } from "../lib/services/respan-gateway.service";

const modelsToTest = [
  "gemini-4-carbon",
  "gemini-4-carbon:free",
  "google_gemini_ai/gemini-4-carbon:free",
  "google_gemini_ai/gemini-4-carbon",
];

async function main() {
  console.log("=== Checking Respan Gateway API Access for Gemini 4 Carbon ===\n");

  for (const model of modelsToTest) {
    console.log(`Testing model: [${model}]...`);
    try {
      let output = "";
      await streamRespanCompletion(
        "Say 'Connection successful!' in 5 words or less.",
        (chunk) => {
          output += chunk;
        },
        model
      );
      console.log(`\n🎉 SUCCESS! Model [${model}] responded:`);
      console.log(`"${output.trim()}"\n`);
      return;
    } catch (err: any) {
      console.log(`❌ Failed: HTTP ${err?.status || "unknown"} - ${err?.message || err}`);
      if (err?.code) console.log(`   Error Code: ${err.code}`);
      console.log();
    }
  }

  console.log("=== All model checks finished ===");
}

main();
