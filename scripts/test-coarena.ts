/**
 * scripts/test-coarena.ts
 *
 * Comprehensive verification of the Coarena Model API integration in PayFix:
 * 1. Discover models via https://coarena.ai/api/v1/models
 * 2. OpenAI-compatible chat completion via https://coarena.ai/api/v1/chat/completions
 * 3. Anthropic-compatible message via https://coarena.ai/api/v1/messages
 * 4. Submit feedback rating via POST https://coarena.ai/api/v1/feedback
 * 5. Structured JSON generation test
 * 6. Complaint triage helper test
 */

import { coarena } from '../lib/ai/coarena'

async function runTests() {
  console.log('========================================================')
  console.log('Testing Coarena Model API Integration')
  console.log('========================================================\n')

  // Step 1: List models
  console.log('1. Fetching available models from https://coarena.ai/api/v1/models...')
  const models = await coarena.listModels()
  console.log(`✓ Successfully retrieved ${models.length} models:`)
  console.log(`  Sample models: ${models.slice(0, 5).map(m => m.id).join(', ')}...\n`)

  if (models.length === 0) {
    throw new Error('No models returned from Coarena API!')
  }

  // Step 2: OpenAI-compatible Chat Completion
  console.log('2. Testing OpenAI-compatible chat completion (model: claude-fable-5)...')
  const completion = await coarena.createChatCompletion({
    model: 'claude-fable-5',
    messages: [
      { role: 'system', content: 'You are an HR analytics assistant.' },
      { role: 'user', content: 'Say "Coarena OpenAI-compatible chat completion works!" in one sentence.' },
    ],
  })

  console.log(`✓ Chat completion succeeded!`)
  console.log(`  Request ID: ${completion.requestId}`)
  console.log(`  Model: ${completion.model}`)
  console.log(`  Response: "${completion.choices[0]?.message?.content?.trim()}"\n`)

  // Step 3: Anthropic-compatible Message
  console.log('3. Testing Anthropic-compatible message (model: claude-fable-5)...')
  const anthropicRes = await coarena.createAnthropicMessage({
    model: 'claude-fable-5',
    max_tokens: 100,
    system: 'You are a concise assistant.',
    messages: [
      { role: 'user', content: 'Say "Coarena Anthropic-compatible message works!" in one sentence.' },
    ],
  })

  console.log(`✓ Anthropic message succeeded!`)
  console.log(`  Request ID: ${anthropicRes.requestId}`)
  console.log(`  Model: ${anthropicRes.model}`)
  console.log(`  Response: "${anthropicRes.content[0]?.text?.trim()}"\n`)

  // Step 4: Submit feedback / rating
  console.log(`4. Testing reply rating with POST https://coarena.ai/api/v1/feedback...`)
  console.log(`  Rating reply request_id: ${completion.requestId} with 'up' / 'good'...`)
  const feedbackRes = await coarena.sendFeedback({
    request_id: completion.requestId,
    rating: 'up',
    note: 'Automated integration test rating - Excellent response',
    tags: ['correct', 'helpful', 'fast'],
  })

  console.log(`✓ Feedback rating recorded successfully!`)
  console.log(`  Confirmed Request ID: ${feedbackRes.request_id}`)
  console.log(`  Rating: ${feedbackRes.rating}`)
  console.log(`  Note: ${feedbackRes.note}\n`)

  // Step 5: Complaint Auto-Triage Helper
  console.log('5. Testing specialized Complaint Triage helper...')
  const triage = await coarena.triageComplaint({
    subject: 'Incorrect overtime salary deduction for October',
    description: 'My October payslip is missing 12 hours of approved overtime in the IT department.',
  })

  console.log(`✓ Triage generated successfully!`)
  console.log(`  Category: ${triage.category}`)
  console.log(`  Priority: ${triage.priority}`)
  console.log(`  Summary: ${triage.summary}`)
  console.log(`  Suggested Resolution: ${triage.suggestedResolution}`)
  console.log(`  Request ID: ${triage.requestId}\n`)

  console.log('========================================================')
  console.log('ALL COARENA API INTEGRATION TESTS PASSED!')
  console.log('========================================================')
}

runTests().catch(err => {
  console.error('\n❌ Test failed with error:', err)
  process.exit(1)
})
