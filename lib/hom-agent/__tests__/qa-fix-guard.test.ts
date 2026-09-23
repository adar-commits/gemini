import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatQaFixGuardReport,
  scanAddedLine,
  scanUnifiedDiff,
} from "@/lib/hom-agent/qa-fix-guard"

describe("qa-fix-guard", () => {
  it("allows prompt and hint edits with Hebrew prose", () => {
    const violations = scanAddedLine({
      file: "lib/hom-agent/conversation-hints.ts",
      lineNumber: 10,
      line: '+      "כן after handoff offer = confirm — use human_service action"',
    })
    assert.deepEqual(violations, [])
  })

  it("blocks new sanitize export", () => {
    const violations = scanAddedLine({
      file: "lib/agents/policy-subjects.ts",
      lineNumber: 1,
      line: "+export function sanitizeHandoffReply(reply: string) {",
    })
    assert.equal(violations[0]?.ruleId, "no_new_sanitize_export")
  })

  it("blocks Hebrew customer intent regex in off-topic", () => {
    const violations = scanAddedLine({
      file: "lib/agents/off-topic.ts",
      lineNumber: 42,
      line: "+  if (/קבלה/.test(userText)) return true",
    })
    assert.equal(violations[0]?.ruleId, "no_hebrew_customer_intent_regex")
  })

  it("blocks new structured pre-turn arm", () => {
    const violations = scanAddedLine({
      file: "lib/hom-agent/pre-turn.ts",
      lineNumber: 99,
      line: "+export function runStructuredReceiptPreTurn() {",
    })
    assert.equal(violations[0]?.ruleId, "no_pre_turn_customer_intent_arm")
  })

  it("respects qa-fix-guard allow marker", () => {
    const violations = scanAddedLine({
      file: "lib/agents/off-topic.ts",
      lineNumber: 42,
      line: "+  if (/קבלה/.test(userText)) return true // qa-fix-guard: allow legacy",
    })
    assert.deepEqual(violations, [])
  })

  it("scans unified diff hunks", () => {
    const diff = [
      "diff --git a/lib/agents/off-topic.ts b/lib/agents/off-topic.ts",
      "+++ b/lib/agents/off-topic.ts",
      "@@ -1,3 +1,4 @@",
      " context",
      "+if (/משלוח/.test(body)) return 'shipping'",
    ].join("\n")

    const violations = scanUnifiedDiff(diff)
    assert.equal(violations.length, 1)
    assert.match(formatQaFixGuardReport(violations), /BLOCKED/)
  })
})
