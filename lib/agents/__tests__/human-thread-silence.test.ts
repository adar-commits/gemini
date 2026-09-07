import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  shouldBypassHumanThreadSilence,
  shouldClearHumanThreadOnBypass,
} from "@/lib/agents/off-topic"

describe("shouldBypassHumanThreadSilence", () => {
  it("stays silent on thanks when a live rep spoke last", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "היי מיכל, מצטערת על העיכוב במענה",
      },
    ]

    assert.equal(shouldBypassHumanThreadSilence("תודה", history), false)
    assert.equal(shouldClearHumanThreadOnBypass("תודה", history), false)
  })

  it("allows thanks after the bot confirmed handoff", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם.",
        action: "human_service",
      },
    ]

    assert.equal(shouldBypassHumanThreadSilence("בסדר תודה", history), true)
    assert.equal(shouldClearHumanThreadOnBypass("בסדר תודה", history), false)
  })

  it("still bypasses pending handoff confirm answers", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "שאעביר את השיחה לנציג אנושי?",
      },
    ]

    assert.equal(shouldBypassHumanThreadSilence("כן", history), true)
    assert.equal(shouldClearHumanThreadOnBypass("כן", history), true)
  })
})
