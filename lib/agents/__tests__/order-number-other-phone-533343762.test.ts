import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderNotOnPhoneAskOrderPhonePrompt,
  isAlternatePhoneRequestPending,
  isNoOrdersFoundReplyPending,
  isPhoneLookupConfirmPending,
} from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"

describe("533343762 — order number placed on someone else's phone", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "רציתי לדעת למה לא מגיע המשלוח שהזמנתי לפני חודש?!" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* יש לך מספר הזמנה? (למשל #36805) אם אין, אפשר לאתר אותה לפי הטלפון שממנו את כותבת.",
    },
    { role: "user", content: "#75936" },
  ]

  const reply = buildOrderNotOnPhoneAskOrderPhonePrompt(
    "#75936",
    "0527374423",
    history,
    "#75936"
  )

  it("names the order number and asks for the order's phone instead of offering a rep", () => {
    assert.match(reply, /#75936/)
    assert.match(reply, /מה מספר הטלפון שבוצעה עליו ההזמנה\?/)
    assert.doesNotMatch(reply, /לא מצאתי הזמנות פעילות לפי הטלפון/)
    assert.doesNotMatch(reply, /נציג/)
    assert.doesNotMatch(reply, /\(\(/)
  })

  it("binds the next turn as the alternate-phone answer, not a chat-phone confirm", () => {
    const next: HistoryMessage[] = [...history, { role: "assistant", content: reply }]
    assert.equal(isAlternatePhoneRequestPending(next), true)
    assert.equal(isPhoneLookupConfirmPending(next), false)
    assert.equal(isNoOrdersFoundReplyPending(next), false)
  })
})
