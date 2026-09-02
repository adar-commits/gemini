import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldProcessPhone, shouldReplyPhone, landbotPhonePolicy } from "@/lib/landbot/allowlist"
import { isTrainerPhone } from "@/lib/landbot/trainer"
import { isTrainerResetRequest } from "@/lib/landbot/trainer-reset"
import { isTrainerResetRequest } from "@/lib/landbot/trainer-reset"

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

  it("uses LANDBOT_TRAINER_PHONES when set", () => {
    const previous = process.env.LANDBOT_TRAINER_PHONES
    process.env.LANDBOT_TRAINER_PHONES = "+972523925554,+972547495083"
    try {
      assert.equal(shouldProcessPhone("+972523925554"), true)
      assert.equal(shouldProcessPhone("+972547495083"), true)
      assert.equal(shouldProcessPhone("972506703444"), false)
      assert.deepEqual(landbotPhonePolicy().trainers, [
        "+972523925554",
        "+972547495083",
      ])
    } finally {
      if (previous === undefined) delete process.env.LANDBOT_TRAINER_PHONES
      else process.env.LANDBOT_TRAINER_PHONES = previous
    }
  })

  it("opens all customers when LANDBOT_TRAINER_PHONES is *", () => {
    const previous = process.env.LANDBOT_TRAINER_PHONES
    process.env.LANDBOT_TRAINER_PHONES = "*"
    try {
      assert.equal(shouldProcessPhone("972506703444"), true)
      assert.equal(shouldReplyPhone("+972547495083"), true)
      assert.equal(landbotPhonePolicy().mode, "all_customers")
      assert.equal(isTrainerPhone("+972547495083"), true)
      assert.equal(isTrainerResetRequest("+972547495083", "איפוס"), true)
      assert.equal(isTrainerPhone("+972523925554"), false)
    } finally {
      if (previous === undefined) delete process.env.LANDBOT_TRAINER_PHONES
      else process.env.LANDBOT_TRAINER_PHONES = previous
    }
  })

  it("allows trainer reset for explicit trainer alongside *", () => {
    const previous = process.env.LANDBOT_TRAINER_PHONES
    process.env.LANDBOT_TRAINER_PHONES = "*,+972523925554"
    try {
      assert.equal(isTrainerPhone("+972523925554"), true)
      assert.equal(isTrainerResetRequest("+972523925554", "איפוס"), true)
      assert.deepEqual(landbotPhonePolicy().explicitTrainers, ["+972523925554"])
    } finally {
      if (previous === undefined) delete process.env.LANDBOT_TRAINER_PHONES
      else process.env.LANDBOT_TRAINER_PHONES = previous
    }
  })

  it("ignores legacy LANDBOT_PROCESS_PHONES / LANDBOT_REPLY_PHONES", () => {
    const prevProcess = process.env.LANDBOT_PROCESS_PHONES
    const prevReply = process.env.LANDBOT_REPLY_PHONES
    process.env.LANDBOT_PROCESS_PHONES = "*"
    process.env.LANDBOT_REPLY_PHONES = "*"
    try {
      assert.equal(shouldProcessPhone("972506703444"), false)
      assert.equal(landbotPhonePolicy().mode, "trainer_only")
      assert.equal(landbotPhonePolicy().env, "LANDBOT_TRAINER_PHONES")
    } finally {
      if (prevProcess === undefined) delete process.env.LANDBOT_PROCESS_PHONES
      else process.env.LANDBOT_PROCESS_PHONES = prevProcess
      if (prevReply === undefined) delete process.env.LANDBOT_REPLY_PHONES
      else process.env.LANDBOT_REPLY_PHONES = prevReply
    }
  })
})
