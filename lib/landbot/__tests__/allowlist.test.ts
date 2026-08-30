import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldProcessPhone, shouldReplyPhone, landbotPhonePolicy } from "@/lib/landbot/allowlist"

describe("trainer-only allowlist", () => {
  it("processes and replies only the default trainer phone", () => {
    const trainer = "+972547495083"
    assert.equal(shouldProcessPhone(trainer), true)
    assert.equal(shouldReplyPhone(trainer), true)
    assert.equal(shouldProcessPhone("0547495083"), true)
    assert.equal(shouldReplyPhone("972547495083"), true)
  })

  it("skips real customer phones", () => {
    assert.equal(shouldProcessPhone("972506703444"), false)
    assert.equal(shouldReplyPhone("972506703444"), false)
    assert.equal(shouldProcessPhone(null), false)
    assert.equal(shouldReplyPhone(""), false)
  })

  it("ignores LANDBOT_PROCESS_PHONES=* when set in env", () => {
    const previous = process.env.LANDBOT_PROCESS_PHONES
    process.env.LANDBOT_PROCESS_PHONES = "*"
    try {
      assert.equal(shouldProcessPhone("972506703444"), false)
      assert.equal(landbotPhonePolicy().mode, "trainer_only")
    } finally {
      if (previous === undefined) delete process.env.LANDBOT_PROCESS_PHONES
      else process.env.LANDBOT_PROCESS_PHONES = previous
    }
  })
})
