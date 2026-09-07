import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  gokuAutoApplyConfidence,
  gokuAutoApplyMode,
  gokuWeeklyApplyConfidence,
  isGokuTrainerEnabled,
  isValidLearnedRuleSuggestion,
  parseReportSuggestions,
  runGokuTrainer,
  scheduleGokuTrainerBeforeTrainerReset,
  type GokuSuggestion,
} from "@/lib/agents/goku-trainer"

const ENV_KEYS = [
  "GOKU_TRAINER_ENABLED",
  "GOKU_AUTO_APPLY_CONFIDENCE",
  "GOKU_AUTO_APPLY_MODE",
  "GOKU_WEEKLY_APPLY_CONFIDENCE",
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
  it("is ON by default (owner decision — GOKU inspects every conversation)", () => {
    const snapshot = saveEnv()
    delete process.env.GOKU_TRAINER_ENABLED
    assert.equal(isGokuTrainerEnabled(), true)
    restoreEnv(snapshot)
  })

  it("can be paused with falsy values", () => {
    const snapshot = saveEnv()
    for (const value of ["0", "false", "off"]) {
      process.env.GOKU_TRAINER_ENABLED = value
      assert.equal(isGokuTrainerEnabled(), false, value)
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

describe("goku apply modes", () => {
  it("defaults to weekly mode with 0.92 threshold", () => {
    const snapshot = saveEnv()
    delete process.env.GOKU_AUTO_APPLY_MODE
    delete process.env.GOKU_WEEKLY_APPLY_CONFIDENCE
    assert.equal(gokuAutoApplyMode(), "weekly")
    assert.equal(gokuWeeklyApplyConfidence(), 0.92)
    restoreEnv(snapshot)
  })

  it("supports realtime auto apply mode", () => {
    const snapshot = saveEnv()
    process.env.GOKU_AUTO_APPLY_MODE = "realtime"
    assert.equal(gokuAutoApplyMode(), "realtime")
    restoreEnv(snapshot)
  })
})

describe("isValidLearnedRuleSuggestion", () => {
  const base: GokuSuggestion = {
    id: "s1",
    type: "learned_rule",
    bucket: "prompt_tweak",
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

describe("parseReportSuggestions", () => {
  it("fills missing rule_text from description for learned_rule", () => {
    const parsed = parseReportSuggestions([
      {
        id: "s1",
        type: "learned_rule",
        bucket: "prompt_tweak",
        confidence: 0.9,
        title: "ניתוב",
        description: "כששואלים על החזר — FAQ",
        rule_kind: "prompt_rule",
        status: "proposed",
      },
    ])
    assert.equal(parsed[0]?.rule_text, "כששואלים על החזר — FAQ")
    assert.equal(parsed[0]?.bucket, "prompt_tweak")
    assert.equal(isValidLearnedRuleSuggestion(parsed[0]!), true)
  })
})

describe("scheduleGokuTrainerBeforeTrainerReset", () => {
  it("no-ops when disabled", async () => {
    const snapshot = saveEnv()
    process.env.GOKU_TRAINER_ENABLED = "0"
    await scheduleGokuTrainerBeforeTrainerReset("12345")
    restoreEnv(snapshot)
  })
})

describe("runGokuTrainer", () => {
  it("skips when explicitly disabled", async () => {
    const snapshot = saveEnv()
    process.env.GOKU_TRAINER_ENABLED = "0"
    const result = await runGokuTrainer("12345", "inactivity_close")
    assert.deepEqual(result, { ok: true, skipped: "disabled" })
    restoreEnv(snapshot)
  })
})
