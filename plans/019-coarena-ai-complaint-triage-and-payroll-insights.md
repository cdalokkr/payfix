# Plan 019: Coarena AI Complaint Triage & Payroll Insights UI Integration

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e3e8858..HEAD -- lib/trpc/routers/ai.ts app/api/ai/coarena/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: [x] DONE (Generated with gemini-4-carbon req_UEyidXuIPzuPUsoYxCp9UP3e, rated good; tested & verified with tsc, eslint and test:coarena)
- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction / ai / features
- **Planned at**: commit `e3e8858`, 2026-11-11

## Why this matters

PayFix now has a high-performance Coarena AI Model API client ([`lib/ai/coarena.ts`](file:///d:/payfix/lib/ai/coarena.ts)) supporting `gemini-4-carbon`, `gemini-4-argon`, and `claude-fable-5`, as well as a dedicated tRPC router ([`lib/trpc/routers/ai.ts`](file:///d:/payfix/lib/trpc/routers/ai.ts)). However, this backend capability is not yet surfaced in the Admin and Moderator dashboards. Hooking `trpc.ai.triageComplaint` into the Complaints management screen gives administrators instant AI-powered issue classification and proposed resolution steps, with a thumbs-up/thumbs-down rating action feeding directly into Coarena's `/feedback` endpoint.

## Current state

- `lib/trpc/routers/ai.ts`:
  - `trpc.ai.triageComplaint`: analyzes subject and description, returns `{ category, priority, summary, suggestedResolution, requestId }`.
  - `trpc.ai.rateReply`: rates reply by `requestId` (`up`, `down`, `good`, `bad`).
- `features/complaints/`: contains admin/moderator complaint tables and views.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0, no errors   |
| Test      | `pnpm run test:coarena`  | all tests pass      |

## Scope

**In scope**:
- `features/complaints/` (complaint detail view or modal)
- UI button "AI Triage & Assist"

**Out of scope**:
- Do not expose `COARENA_API_KEY` to client-side code; all calls must route through `trpc.ai` or `/api/ai/coarena`.

## Git workflow

- Branch: `advisor/019-coarena-complaint-triage-ui`
- Commit message: `feat(complaints): add Coarena AI auto-triage and resolution recommendation in complaints UI`

## Detailed Implementation Steps

### Step 1: Add AI Triage Card in Complaint Detail View
In the complaint detail component, add an "AI Assist" button:
```tsx
const triageMutation = trpc.ai.triageComplaint.useMutation();
const rateMutation = trpc.ai.rateReply.useMutation();

// On Click:
const onAutoTriage = async () => {
  const result = await triageMutation.mutateAsync({
    subject: complaint.subject,
    description: complaint.description,
  });
  setAiSuggestion(result);
};
```

### Step 2: Render AI Resolution & Feedback Rating Widget
Display the recommended priority, category badge, and suggested resolution with thumbs up / down buttons:
```tsx
{aiSuggestion && (
  <div className="bg-slate-900/60 border border-indigo-500/30 rounded-xl p-4 mt-4 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase text-indigo-400">Coarena AI Triage</span>
      <div className="flex gap-1">
        <button onClick={() => rateMutation.mutate({ requestId: aiSuggestion.requestId, rating: 'up' })}>👍</button>
        <button onClick={() => rateMutation.mutate({ requestId: aiSuggestion.requestId, rating: 'down' })}>👎</button>
      </div>
    </div>
    <p className="text-sm text-slate-200">{aiSuggestion.suggestedResolution}</p>
  </div>
)}
```

### Step 3: Run Verification
```bash
pnpm run test:coarena
pnpm run typecheck
```

## STOP conditions
- If the complaint has no description or text length is under 5 characters, disable the AI assist button.
