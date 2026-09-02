import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isTrainerResetCommand,
  isTrainerResetRequest,
  splitTrainerResetBody,
} from "@/lib/landbot/trainer-reset"

describe("splitTrainerResetBody", () => {
  it("treats exact איפוס as reset-only", () => {
    const split = splitTrainerResetBody("איפוס")
    assert.equal(split.isReset, true)
    assert.equal(split.isResetOnly, true)
    assert.equal(split.remainder, "")
    assert.equal(isTrainerResetCommand("איפוס"), true)
  })

  it("splits reset prefix from a merged burst", () => {
    const split = splitTrainerResetBody(
      "איפוס\nבוקר אור, עד מתי המבצע של 1+1 על הפופים"
    )
    assert.equal(split.isReset, true)
    assert.equal(split.isResetOnly, false)
    assert.match(split.remainder, /1\+1/)
    assert.equal(isTrainerResetCommand(split.remainder), false)
  })

  it("ignores non-reset text", () => {
    const split = splitTrainerResetBody("בוקר אור, עד מתי המבצע")
    assert.equal(split.isReset, false)
    assert.equal(split.remainder, "בוקר אור, עד מתי המבצע")
  })

  it("detects trainer reset request for allowlisted phone", () => {
    const previous = process.env.LANDBOT_TRAINER_PHONES
    process.env.LANDBOT_TRAINER_PHONES = "+972547495083"
    try {
      assert.equal(isTrainerResetRequest("+972547495083", "איפוס"), true)
      assert.equal(isTrainerResetRequest("0547495083", "איפוס"), true)
      assert.equal(isTrainerResetRequest("+972506703444", "איפוס"), false)
      assert.equal(isTrainerResetRequest("+972547495083", "היי"), false)
    } finally {
      if (previous === undefined) delete process.env.LANDBOT_TRAINER_PHONES
      else process.env.LANDBOT_TRAINER_PHONES = previous
    }
  })
})
