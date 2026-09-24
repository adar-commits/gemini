import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isTrainerResetMessage,
  pickQaEventWindow,
} from "@/lib/landbot/qa-event-window"

describe("qa event window", () => {
  it("detects trainer reset messages", () => {
    assert.equal(isTrainerResetMessage("איפוס"), true)
    assert.equal(isTrainerResetMessage("איפוס\nלימוד גוקו"), true)
    assert.equal(isTrainerResetMessage("איפוס "), true)
    assert.equal(isTrainerResetMessage("לא איפוס"), false)
  })

  it("prefers the newest boundary among opened_at, agent reset, trainer reset", () => {
    const window = pickQaEventWindow({
      openedAt: "2026-09-24T17:32:43.000Z",
      agentResetAt: "2026-09-24T18:00:00.000Z",
      trainerResetAt: "2026-09-24T20:17:50.000Z",
    })
    assert.equal(window.reason, "trainer_reset")
    assert.equal(window.since, "2026-09-24T20:17:50.000Z")
  })

  it("uses opened_at when it is the newest boundary", () => {
    const window = pickQaEventWindow({
      openedAt: "2026-09-24T20:30:00.000Z",
      agentResetAt: "2026-09-24T18:00:00.000Z",
      trainerResetAt: "2026-09-24T20:17:50.000Z",
    })
    assert.equal(window.reason, "opened_at")
    assert.equal(window.since, "2026-09-24T20:30:00.000Z")
  })

  it("falls back to tail window when no boundaries exist", () => {
    const now = new Date("2026-09-24T21:00:00.000Z")
    const window = pickQaEventWindow({ now })
    assert.equal(window.reason, "tail_fallback")
    assert.equal(window.since, "2026-09-23T21:00:00.000Z")
  })
})
