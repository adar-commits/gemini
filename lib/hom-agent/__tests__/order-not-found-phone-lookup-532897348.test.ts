import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderNumberNotFoundReply,
  isOrderNumberNotFoundReplyPending,
} from "@/lib/agents/order-lookup"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import type { HistoryMessage } from "@/lib/agents/types"

describe("532897348 — RC not found, customer asks to look up by chat phone", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "רציתי לברר בנוגע להזמנה שביצעתי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה. מה רצית לברר לגבי ההזמנה — מתי היא מגיעה, שינוי בהזמנה או משהו אחר?",
    },
    { role: "user", content: "מתי היא מגיעה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כדי לבדוק מתי ההזמנה מגיעה — יש מספר הזמנה? (למשל #36805) אם אין, אפשר לאתר לפי מספר הטלפון שממנו מתכתבים — רק לאשר שההזמנה רשומה עליו.",
    },
    { role: "user", content: "RC269020946 זה?" },
  ]
  const notFound = buildOrderNumberNotFoundReply("RC269020946", history, "RC269020946 זה?")
  const afterNotFound: HistoryMessage[] = [
    ...history,
    { role: "assistant", content: notFound },
  ]
  const body = "אפשר על המספר טלפון שממנו אני מתכתב"

  it("keeps the order-status ask open after the not-found reply", () => {
    assert.equal(isOrderNumberNotFoundReplyPending(afterNotFound), true)
    assert.equal(isOrderNumberNotFoundReplyPending(history), false)
  })

  it("order-status tool runs the phone lookup instead of refusing the turn", async () => {
    const result = await executeLookupOrderStatus({
      body,
      history: afterNotFound,
      phone: "972545446513",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.action, "reply")
    assert.doesNotMatch(result.reply, /לא יכול לאתר/)
    assert.match(result.reply, /054-5446513/)
  })
})
