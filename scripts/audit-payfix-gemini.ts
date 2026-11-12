import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { generateGeminiContent, GeminiFileContext } from "../lib/services/gemini.service";

interface AuditConfig {
  name: string;
  outputPath: string;
  focusFiles: string[];
  auditPrompt: string;
}

const OPTION_C_CONFIG: AuditConfig = {
  name: "PayFix Comprehensive Codebase Audit (Option C)",
  outputPath: "docs/gemini-4-hydrogen-full-codebase-audit.md",
  focusFiles: [
    "package.json",
    "next.config.ts",
    "lib/services/attendance.service.ts",
    "lib/services/salary.service.ts",
    "lib/services/shifts.service.ts",
    "lib/services/profile.service.ts",
    "app/api/biometric/sync/route.ts",
    "lib/tenant/schema-contract.test.ts",
  ],
  auditPrompt: `
You are the Principal Software Architect and Security Auditor performing an exhaustive, comprehensive audit of the **PayFix** production codebase.

PayFix is a mission-critical, enterprise multi-tenant biometric attendance and automated payroll SaaS built with Next.js 16 (React 19), Turbopack, Supabase (PostgreSQL with RLS), ONNX / MediaPipe biometric face verification, and client/server real-time state synchronization.

Audit the attached files with maximum rigor across the following 5 critical dimensions:

1. **Multi-Tenant Security & Tenant Isolation Contract**:
   - Verify whether every query and service method strictly scopes operations by \`tenant_id\`.
   - Identify potential Cross-Tenant IDOR (Insecure Direct Object Reference) vulnerabilities or un-scoped queries.
   - Audit RLS compatibility and service-role bypass safety.

2. **Biometric Attendance Verification & Edge Cases**:
   - Audit liveness verification, cosine similarity thresholds (0.80), and face vector validation in \`attendance.service.ts\` and \`app/api/biometric/sync/route.ts\`.
   - Check clock-in/out state machine integrity (preventing duplicate punches, handling out-of-order kiosk syncs, offline-first race conditions).
   - Evaluate biometric PII handling and privacy compliance.

3. **Payroll & Salary Calculation Accuracy**:
   - Audit \`salary.service.ts\` for rounding errors, shift differential calculations, overtime calculations, unpaid leave deductions, and edge-case date arithmetic across month boundaries.
   - Verify idempotency of payroll generation runs to prevent duplicate salary disbursements or corrupted ledger entries.

4. **Next.js 16 & Turbopack Architectural Best Practices**:
   - Validate compliance with Next.js 16 App Router standards (React 19 Server Components, Server Actions vs Route Handlers, header/cookie handling, dynamic vs static rendering).
   - Identify bundle size risks, performance bottlenecks, or improper client/server component boundaries.

5. **Type Safety, Error Handling & System Resilience**:
   - Strict TypeScript type safety, elimination of \`any\` types where unsafe.
   - Unhandled Promise rejections, missing database transaction rollbacks, or missing retry logic on network timeouts.

### Deliverable Format:
Produce a detailed, publication-ready Markdown audit report structured as follows:
- **Executive Summary & Health Score (0-100)**
- **Critical & High Severity Findings (with exact code snippets and vulnerable lines)**
- **Medium & Low Severity Findings (code smells, optimizations, edge cases)**
- **Prioritized Action Plan (Phase 1 Immediate, Phase 2 Medium-term, Phase 3 Enhancements)**
- **Exact Code Patches & Drop-In Replacements for the top 3 most critical issues**
`,
};

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 PayFix Full Repository Audit via Gemini 4 Hydrogen`);
  console.log(`Model:    ${process.env.GEMINI_MODEL || "gemini-4-hydrogen"}`);
  console.log(`Mode:     Google AI Studio Native API`);
  console.log(`Scope:    Option C (Comprehensive Architecture, Security, Payroll, Biometrics)`);
  console.log(`======================================================\n`);

  const fileContexts: GeminiFileContext[] = [];

  for (const relPath of OPTION_C_CONFIG.focusFiles) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Warning: Target file not found: ${relPath}`);
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    const stat = fs.statSync(fullPath);
    console.log(`Loaded: ${relPath} (${(stat.size / 1024).toFixed(1)} KB)`);
    fileContexts.push({ path: relPath, content });
  }

  console.log(`\nTotal files loaded into 1M context: ${fileContexts.length}`);
  console.log(`Dispatching audit to Gemini 4 Hydrogen with deep thinking mode enabled...\n`);

  try {
    const startTime = Date.now();
    const result = await generateGeminiContent(OPTION_C_CONFIG.auditPrompt, fileContexts, {
      model: process.env.GEMINI_MODEL || "gemini-4-hydrogen",
      temperature: 0.2, // Low temperature for high precision and analytical rigor
      systemInstruction:
        "You are a top-tier Principal Systems Architect and Staff Security Engineer auditing a high-stakes multi-tenant enterprise biometric payroll system. Your analysis must be extraordinarily precise, citing exact lines and providing concrete code fixes.",
    });

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Gemini 4 Hydrogen Audit Completed in ${elapsedSec}s!`);
    if (result.usage) {
      console.log(`📊 Token Stats:`);
      console.log(`   - Input Tokens:     ${result.usage.promptTokenCount?.toLocaleString() ?? "N/A"}`);
      console.log(`   - Reasoning Tokens: ${result.usage.thoughtsTokenCount?.toLocaleString() ?? "N/A"}`);
      console.log(`   - Output Tokens:    ${result.usage.candidatesTokenCount?.toLocaleString() ?? "N/A"}`);
      console.log(`   - Total Tokens:     ${result.usage.totalTokenCount?.toLocaleString() ?? "N/A"}`);
    }

    const outPath = path.resolve(process.cwd(), OPTION_C_CONFIG.outputPath);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const auditHeader = `# PayFix Comprehensive Codebase Audit Report (Gemini 4 Hydrogen)

- **Date:** ${new Date().toISOString()}
- **Model:** ${result.model}
- **Auditor:** Google AI Studio (Gemini 4 Hydrogen with Native Reasoning)
- **Branch:** develop
- **Scope:** Option C — Architecture, Multi-Tenant Security, Biometric Pipeline, Payroll Engine, Next.js 16

---

`;

    fs.writeFileSync(outPath, auditHeader + result.text, "utf-8");
    console.log(`\n📄 Report saved successfully to: ${OPTION_C_CONFIG.outputPath}\n`);
  } catch (err: any) {
    console.error(`\n❌ Error during Gemini 4 Hydrogen audit execution:`);
    console.error(err?.message || err);
    process.exit(1);
  }
}

main();
