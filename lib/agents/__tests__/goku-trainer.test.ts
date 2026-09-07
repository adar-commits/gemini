import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  gokuAutoApplyConfidence,
  isGokuTrainerEnabled,
  isValidLearnedRuleSuggestion,
  runGokuTrainer,
  type GokuSuggestion,
} from "@/lib/agents/goku-trainer"

const ENV_KEYS = [
  "GOKU_TRAINER_ENABLED",
  "GOKU_AUTO_APPLY_CONFIDENCE",
] as const

function saveEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe("isGokuTrainerEnabled", () => {
  it("is off by default", () => {
    const snapshot = saveEnv()
    delete process.env.GOKU_TRAINER_ENABLED
    assert.equal(isGokuTrainerEnabled(), false)
    restoreEnv(snapshot)
  })

  it("accepts common truthy values", () => {
    const snapshot = saveEnv()
    for (const value of ["1", "true", "on", "TRUE"]) {
      process.env.GOKU_TRAINER_ENABLED = value
      assert.equal(isGokuTrainerEnabled(), true, value)
    }
    restoreEnv(snapshot)
  })
})

describe("gokuAutoApplyConfidence", () => {
  it("defaults to 0.85", () => {
    const snapshot = saveEnv()
    delete process.env.GOKU_AUTO_APPLY_CONFIDENCE
    assert.equal(gokuAutoApplyConfidence(), 0.85)
    restoreEnv(snapshot)
  })

  it("clamps to 0-1", () => {
    const snapshot = saveEnv()
    process.env.GOKU_AUTO_APPLY_CONFIDENCE = "1.5"
    assert.equal(gokuAutoApplyConfidence(), 1)
    process.env.GOKU_AUTO_APPLY_CONFIDENCE = "-0.2"
    assert.equal(gokuAutoApplyConfidence(), 0)
    restoreEnv(snapshot)
  })
})

describe("isValidLearnedRuleSuggestion", () => {
  const base: GokuSuggestion = {
    id: "s1",
    type: "learned_rule",
    confidence: 0.9,
    title: "route refund timeline",
    description: "route refund questions to FAQ policy",
    rule_kind: "route_regex",
    pattern: "מתי.*החזר",
    route_action: "ROUTE_TO_INFO_AGENT",
    rule_text: "שאלות על לוח זמנים להחזר כספי → FAQ policy, לא מיקום סניף",
    status: "proposed",
  }

  it("accepts a safe route_regex suggestion", () => {
    assert.equal(isValidLearnedRuleSuggestion(base), true)
  })

  it("rejects overly broad patterns", () => {
    assert.equal(
      isValidLearnedRuleSuggestion({ ...base, pattern: ".*" }),
      false
    )
  })

  it("requires route_action for route_regex", () => {
    assert.equal(
      isValidLearnedRuleSuggestion({ ...base, route_action: undefined }),
      false
    )
  })

  it("accepts prompt_rule without pattern", () => {
    assert.equal(
      isValidLearnedRuleSuggestion({
        ...base,
        rule_kind: "prompt_rule",
        pattern: undefined,
        route_action: undefined,
      }),
      true
    )
  })
})

describe("runGokuTrainer", () => {
  it("skips when disabled", async () => {
    const snapshot = saveEnv()
    delete process.env.GOKU_TRAINER_ENABLED
    const result = await runGokuTrainer("12345", "inactivity_close")
    assert.deepEqual(result, { ok: true, skipped: "disabled" })
    restoreEnv(snapshot)
  })
})
