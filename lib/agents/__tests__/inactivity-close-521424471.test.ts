import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildInactivityCloseReply,
  buildInactivityPingReply,
  inactivityCloseBlockReason,
  isInactivityCloseMessage,
  isInactivityPingMessage,
} from "@/lib/agents/inactivity"
import { botIsWaitingFromTimestamps } from "@/lib/agents/inactivity-session"

const CLOSE_NOTICE = buildInactivityCloseReply()
const PING = buildInactivityPingReply("صهر")

describe("inactivity close 521424471", () => {
  it("does not treat a prior close notice as a live ping", () => {
    assert.equal(isInactivityCloseMessage(CLOSE_NOTICE), true)
    assert.equal(isInactivityPingMessage(CLOSE_NOTICE), false)
    assert.equal(inactivityCloseBlockReason(CLOSE_NOTICE), "already_closed_notice")
  })

  it("still closes only when the last assistant line is עדיין כאן?", () => {
    assert.equal(isInactivityPingMessage(PING), true)
    assert.equal(isInactivityCloseMessage(PING), false)
    assert.equal(inactivityCloseBlockReason(PING), null)
  })

  it("blocks close when last assistant is a real shipping reply", () => {
    assert.equal(
      inactivityCloseBlockReason(
        "זה הגיוני שעדיין לא התקשרו — חברת השליחויות יוצרת קשר עם הלקוח רק ביום האספקה עצמו."
      ),
      "ping_not_last_assistant"
    )
  })

  it("treats an inbound customer stamp after the old close as not waiting", () => {
    assert.equal(
      botIsWaitingFromTimestamps({
        last_assistant_at: "2026-09-16T10:46:54.511Z",
        last_user_at: "2026-09-17T15:02:44.000Z",
      }),
      false
    )
  })
})
