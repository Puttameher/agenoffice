#!/usr/bin/env node
/**
 * scripts/run_router_eval.mjs
 *
 * Phase 3 Router Evaluation Benchmark:
 * - Loads tests/evals/router_eval.jsonl (40 labeled prompts)
 * - Evaluates each prompt against office-router decision engine
 * - Computes overall accuracy (Target: >= 90%)
 * - Computes per-class accuracy (Target: >= 85% for direct, tool, manager)
 * - Builds confidence calibration table
 * - Measures inference latency distribution
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  LlmFallbackBackend,
  JevBackend,
  applyEscalationPolicy,
  ROUTE_DIRECT,
  ROUTE_TOOL,
  ROUTE_MANAGER
} from '../plugins/office-router/src/index.js'

const DATASET_PATH = join(process.cwd(), 'tests', 'evals', 'router_eval.jsonl')

console.log('========================================================================')
console.log('       PHASE 3 ACCEPTANCE: JEV DECISION ROUTER 40-PROMPT EVAL          ')
console.log('========================================================================\n')

// 1. Load labeled dataset
const rawLines = readFileSync(DATASET_PATH, 'utf8').trim().split('\n')
const dataset = rawLines.map(line => JSON.parse(line))
console.log(`[INFO] Loaded ${dataset.length} labeled test cases from ${DATASET_PATH}`)

// 2. Initialize Backend with fallback & escalation
const backend = new LlmFallbackBackend()
const confidenceThreshold = 0.70
console.log(`[INFO] Active backend: ${backend.name} (model: ${backend.model})`)
console.log(`[INFO] Confidence escalation threshold: ${confidenceThreshold.toFixed(2)}\n`)

// 3. Run evaluation
const results = []
const classStats = {
  [ROUTE_DIRECT]: { total: 0, correct: 0 },
  [ROUTE_TOOL]: { total: 0, correct: 0 },
  [ROUTE_MANAGER]: { total: 0, correct: 0 }
}

const confBins = {
  '0.90 - 1.00': { total: 0, correct: 0 },
  '0.80 - 0.89': { total: 0, correct: 0 },
  '0.70 - 0.79': { total: 0, correct: 0 },
  '< 0.70': { total: 0, correct: 0, escalated: 0 }
}

const latencies = []

console.log('------------------------------------------------------------------------')
console.log(' ID | Expected | Predicted | Conf  | Latency | Escalated | Status')
console.log('----+----------+-----------+-------+---------+-----------+---------')

for (const item of dataset) {
  const rawDecision = await backend.evaluate({ message: item.prompt })
  const decision = applyEscalationPolicy(rawDecision, confidenceThreshold)

  const isCorrect = decision.route === item.expected_route
  latencies.push(decision.latencyMs)

  classStats[item.expected_route].total++
  if (isCorrect) classStats[item.expected_route].correct++

  // Calibration binning
  const conf = decision.confidence
  let binKey = '< 0.70'
  if (conf >= 0.90) binKey = '0.90 - 1.00'
  else if (conf >= 0.80) binKey = '0.80 - 0.89'
  else if (conf >= 0.70) binKey = '0.70 - 0.79'

  confBins[binKey].total++
  if (isCorrect) confBins[binKey].correct++
  if (decision.escalated && binKey === '< 0.70') confBins[binKey].escalated++

  const idStr = String(item.id).padStart(3, ' ')
  const expStr = item.expected_route.toUpperCase().padEnd(8, ' ')
  const predStr = decision.route.toUpperCase().padEnd(9, ' ')
  const confStr = `${(decision.confidence * 100).toFixed(0)}%`.padStart(5, ' ')
  const latStr = `${decision.latencyMs}ms`.padStart(7, ' ')
  const escStr = (decision.escalated ? 'YES' : 'no').padStart(9, ' ')
  const statusStr = isCorrect ? '✅ PASS' : '❌ FAIL'

  console.log(` ${idStr} | ${expStr} | ${predStr} | ${confStr} | ${latStr} | ${escStr} | ${statusStr}`)

  results.push({
    ...item,
    predicted_route: decision.route,
    confidence: decision.confidence,
    latencyMs: decision.latencyMs,
    escalated: decision.escalated,
    escalationReason: decision.escalationReason,
    isCorrect
  })

  // Short delay to avoid rate limit bursts
  await new Promise(r => setTimeout(r, 350))
}

console.log('------------------------------------------------------------------------\n')

// 4. Compute Metrics
const total = dataset.length
const correctCount = results.filter(r => r.isCorrect).length
const overallAccuracy = (correctCount / total) * 100

const directAcc = (classStats[ROUTE_DIRECT].correct / classStats[ROUTE_DIRECT].total) * 100
const toolAcc = (classStats[ROUTE_TOOL].correct / classStats[ROUTE_TOOL].total) * 100
const managerAcc = (classStats[ROUTE_MANAGER].correct / classStats[ROUTE_MANAGER].total) * 100

latencies.sort((a, b) => a - b)
const meanLat = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
const p50Lat = latencies[Math.floor(latencies.length * 0.5)]
const p95Lat = latencies[Math.floor(latencies.length * 0.95)]

console.log('========================= EVALUATION RESULTS ===========================')
console.log(`Overall Accuracy:   ${correctCount}/${total} (${overallAccuracy.toFixed(1)}%)  [Target: >= 90%]`)
console.log(`DIRECT Accuracy:    ${classStats[ROUTE_DIRECT].correct}/${classStats[ROUTE_DIRECT].total} (${directAcc.toFixed(1)}%)  [Target: >= 85%]`)
console.log(`TOOL Accuracy:      ${classStats[ROUTE_TOOL].correct}/${classStats[ROUTE_TOOL].total} (${toolAcc.toFixed(1)}%)  [Target: >= 85%]`)
console.log(`MANAGER Accuracy:   ${classStats[ROUTE_MANAGER].correct}/${classStats[ROUTE_MANAGER].total} (${managerAcc.toFixed(1)}%)  [Target: >= 85%]`)
console.log(`Inference Latency:  mean=${meanLat}ms, p50=${p50Lat}ms, p95=${p95Lat}ms\n`)

console.log('----------------- CONFIDENCE CALIBRATION TABLE -------------------------')
console.log(' Bin Range    | Samples | Correct | Accuracy | Escalated ')
console.log('--------------+---------+---------+----------+-----------')
for (const [bin, data] of Object.entries(confBins)) {
  const binAcc = data.total > 0 ? ((data.correct / data.total) * 100).toFixed(1) + '%' : 'N/A'
  const escStr = data.escalated !== undefined ? String(data.escalated) : '-'
  console.log(` ${bin.padEnd(12, ' ')} | ${String(data.total).padStart(7, ' ')} | ${String(data.correct).padStart(7, ' ')} | ${binAcc.padStart(8, ' ')} | ${escStr.padStart(9, ' ')} `)
}
console.log('------------------------------------------------------------------------\n')

// 5. Gate assertions
const overallPass = overallAccuracy >= 90.0
const directPass = directAcc >= 85.0
const toolPass = toolAcc >= 85.0
const managerPass = managerAcc >= 85.0

console.log('>>> ACCEPTANCE GATES STATUS <<<')
console.log(`[${overallPass ? 'PASS' : 'FAIL'}] Overall Accuracy >= 90%: ${overallAccuracy.toFixed(1)}%`)
console.log(`[${directPass ? 'PASS' : 'FAIL'}] DIRECT Accuracy >= 85%: ${directAcc.toFixed(1)}%`)
console.log(`[${toolPass ? 'PASS' : 'FAIL'}] TOOL Accuracy >= 85%: ${toolAcc.toFixed(1)}%`)
console.log(`[${managerPass ? 'PASS' : 'FAIL'}] MANAGER Accuracy >= 85%: ${managerAcc.toFixed(1)}%`)

if (overallPass && directPass && toolPass && managerPass) {
  console.log('\n=== PHASE 3 EVALUATION: ALL GATES PASSED! ===\n')
  process.exit(0)
} else {
  console.error('\n=== PHASE 3 EVALUATION: ONE OR MORE GATES FAILED! ===\n')
  process.exit(1)
}
