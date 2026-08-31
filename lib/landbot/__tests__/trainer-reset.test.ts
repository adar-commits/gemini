import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isTrainerResetCommand,
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
})
