import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isTrainerGokuQaTestCommand,
  TRAINER_GOKU_QA_COMMAND,
} from "@/lib/landbot/training-guards"

describe("trainer goku qa test command", () => {
  it("matches exact phrase only", () => {
    assert.equal(isTrainerGokuQaTestCommand(TRAINER_GOKU_QA_COMMAND), true)
    assert.equal(isTrainerGokuQaTestCommand("  לימוד גוקו  "), true)
    assert.equal(isTrainerGokuQaTestCommand("לימוד גוקו\n"), true)
    assert.equal(isTrainerGokuQaTestCommand("לימוד גוקו בבקשה"), false)
    assert.equal(isTrainerGokuQaTestCommand("איפוס"), false)
  })
})
