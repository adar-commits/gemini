import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildProcessingStuckReply } from "@/lib/agent-core/fallbacks"
import { startProcessingWatchdog } from "@/lib/landbot/processing-watchdog"

describe("processing watchdog", () => {
  it("buildProcessingStuckReply offers wait-or-handoff (not confused fallback)", () => {
    const reply = buildProcessingStuckReply()
    assert.match(reply, /עדיין מעבד/)
    assert.match(reply, /נציג שירות/)
    assert.doesNotMatch(reply, /לא הצלחתי להבין/)
  })

  it("fires onStuck when no reply marked within timeout", async () => {
    let stuck = false
    const watchdog = startProcessingWatchdog({
      replyEnabled: true,
      timeoutMs: 30,
      onStuck: async () => {
        stuck = true
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 60))
    assert.equal(stuck, true)
    assert.equal(watchdog.stuckAlreadySent(), true)
  })

  it("does not fire after markReplySent", async () => {
    let stuck = false
    const watchdog = startProcessingWatchdog({
      replyEnabled: true,
      timeoutMs: 50,
      onStuck: async () => {
        stuck = true
      },
    })

    watchdog.markReplySent()
    await new Promise((resolve) => setTimeout(resolve, 80))
    assert.equal(stuck, false)
  })
})
