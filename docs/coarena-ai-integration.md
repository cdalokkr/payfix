# Coarena Model API Integration Guide

PayFix is integrated with [Coarena](https://coarena.ai)'s free Model API for server-side AI intelligence, complaint & ticket auto-triage, attendance anomaly explanations, and report summarization.

---

## 1. Credentials & Endpoints

| Resource | Value |
| :--- | :--- |
| **OpenAI-compatible Base URL** | `https://coarena.ai/api/v1` |
| **Anthropic-compatible Base URL** | `https://coarena.ai/api` |
| **Model Discovery** | `GET https://coarena.ai/api/v1/models` |
| **Reply Rating / Feedback** | `POST https://coarena.ai/api/v1/feedback` |
| **API Key** | `coa_41031e31310eacb4a558d53e22b65a9e` |
| **Default Recommended Model** | `gemini-3-8-flash` or `claude-fable-5` |

---

## 2. Environment Variables

Defined in `.env`, `.env.local`, and documented in `.env.example`:

```env
# Coarena Model API Configuration
COARENA_API_KEY=coa_41031e31310eacb4a558d53e22b65a9e
COARENA_OPENAI_BASE_URL=https://coarena.ai/api/v1
COARENA_ANTHROPIC_BASE_URL=https://coarena.ai/api
COARENA_DEFAULT_MODEL=gemini-3-8-flash

# Standard SDK compatibility
OPENAI_BASE_URL=https://coarena.ai/api/v1
OPENAI_API_KEY=coa_41031e31310eacb4a558d53e22b65a9e
ANTHROPIC_BASE_URL=https://coarena.ai/api
ANTHROPIC_API_KEY=coa_41031e31310eacb4a558d53e22b65a9e
```

---

## 3. Using the TypeScript Client (`@/lib/ai`)

Import the client anywhere in your server-side code:

```typescript
import { coarena } from '@/lib/ai'

// 1. Generate text with automatic rate() helper
const response = await coarena.generateText('Explain the difference between gross and net salary.', {
  model: 'gemini-3-8-flash',
})
console.log(response.text)
console.log(response.requestId)

// 2. Submit feedback / rate a reply
await response.rate('up', 'Very clear explanation')

// Or rate directly with request ID:
await coarena.sendFeedback({
  request_id: response.requestId,
  rating: 'up', // 'up' | 'down' | 'good' | 'bad'
  tags: ['correct', 'helpful', 'fast'],
  note: 'Accurate and fast response',
})
```

### Structured Output (JSON)

```typescript
const result = await coarena.generateJSON<{ approved: boolean; reason: string }>(
  'Review this leave request: 2 days vacation with 5 accrued days remaining.',
  { system: 'You are an HR approval assistant.' }
)
console.log(result.data.approved)
```

### Auto-Triage Complaints & Tickets

```typescript
const triage = await coarena.triageComplaint({
  subject: 'Incorrect overtime deduction',
  description: 'My October payslip missed 12 hours of overtime.',
})
console.log(triage.category)            // 'billing'
console.log(triage.priority)            // 'high'
console.log(triage.suggestedResolution) // Steps to resolve
```

---

## 4. REST API Endpoints

### `POST /api/ai/coarena`
Execute chat completions:
```json
{
  "prompt": "Hello world",
  "model": "claude-fable-5"
}
```

Or OpenAI messages array:
```json
{
  "model": "claude-fable-5",
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```

### `POST /api/ai/coarena/feedback`
Rate any reply:
```json
{
  "request_id": "req_...",
  "rating": "up",
  "tags": ["helpful", "correct"],
  "note": "Optional feedback note"
}
```

---

## 5. tRPC Router (`trpc.ai`)

In React / Next.js client components:

```tsx
import { trpc } from '@/lib/trpc/client'

// In a component:
const triageMutation = trpc.ai.triageComplaint.useMutation()
const rateMutation = trpc.ai.rateReply.useMutation()

// Trigger triage:
await triageMutation.mutateAsync({
  subject: 'Punch machine disconnected',
  description: 'Device in Sector 5 is unreachable.',
})

// Rate a response:
await rateMutation.mutateAsync({
  requestId: 'req_...',
  rating: 'up',
  tags: ['helpful'],
})
```

---

## 6. Running Verification Tests

Run the full end-to-end test suite against Coarena's live endpoints:

```bash
pnpm run test:coarena
```
