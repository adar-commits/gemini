import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildInactivityDeferAck,
  buildInactivityPingReply,
  isInactivityUnavailableReply,
  shouldSuppressInactivityWatch,
} from "@/lib/agents/inactivity"
import type { HistoryMessage } from "@/lib/agents/types"

describe("inactivity defer after unavailable reply", () => {
  it("detects unavailable replies to the ping", () => {
    assert.equal(isInactivityUnavailableReply("לא זמין/ה כרגע"), true)
    assert.equal(isInactivityUnavailableReply("I'm not available right now"), true)
    assert.equal(isInactivityUnavailableReply("כן"), false)
    assert.equal(isInactivityUnavailableReply("פה"), false)
  })

  it("suppresses repeat ping after defer ack", () => {
    const ping = buildInactivityPingReply("דני")
    const defer = buildInactivityDeferAck("דני")
    const history: HistoryMessage[] = [
      { role: "assistant", content: "שאלה?", agent: "master" },
      { role: "assistant", content: ping, agent: "master" },
      { role: "user", content: "לא פנוי כרגע", agent: null },
      { role: "assistant", content: defer, agent: "master" },
    ]
    assert.equal(shouldSuppressInactivityWatch(history), true)
  })

  it("resumes inactivity watch after customer returns", () => {
    const ping = buildInactivityPingReply()
    const defer = buildInactivityDeferAck()
    const history: HistoryMessage[] = [
      { role: "assistant", content: ping, agent: "master" },
      { role: "user", content: "לא זמין כרגע", agent: null },
      { role: "assistant", content: defer, agent: "master" },
      { role: "user", content: "היי, יש לי שאלה על ההזamנה", agent: null },
    ]
    assert.equal(shouldSuppressInactivityWatch(history), false)
  })
})
