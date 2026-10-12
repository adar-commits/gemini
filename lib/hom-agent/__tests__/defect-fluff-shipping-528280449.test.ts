import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isServiceLookupContext } from "@/lib/agents/order-lookup"
import { isOpenProductQualityServiceThread } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import type { HistoryMessage } from "@/lib/agents/types"

function history528280449(): HistoryMessage[] {
  return [
    { role: "user", content: "היי ערב טוב" },
    {
      role: "assistant",
      content: "*הום בוט :)* היי תמר, ערב טוב! 😊 במה אפשר לעזור?",
    },
    {
      role: "user",
      content:
        "בחודש אוגוסט ביצעתי רכישה של שטיח. כמה שהוא יפה ככה אני מאוכזבת [media:image:https://example.com/rug.jpg]",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצטער לשמוע, תמר. קיבלתי את התמונה, תודה ששלחת. מה בדיוק מאכזב אותך בשטיח? אם יש עוד פלומה וסיבים כמו בפעם הקודמת או משהו אחר, אשמח שתכתבי לי במשפט אחד וכך נוכל להתקדם.",
    },
    {
      role: "user",
      content: "מאז הקנייה אנחנו שואבים 3 פעמים בשבוע. מידי פעם השואב מלא בפלומה",
    },
  ]
}

/** Replay 528280449 — fluff complaint must not route to delivered shipping lookup. */
describe("defect fluff shipping 528280449", () => {
  it("detects open product quality service from photos and fluff follow-up", () => {
    const history = history528280449()
    assert.equal(isOpenProductQualityServiceThread(history), true)
    assert.equal(isServiceLookupContext(history, "faq"), true)
  })

  it("hints service continuation — not shipping delivered close", () => {
    const hints =
      buildConversationHints({
        history: history528280449(),
        body: "הפלומה נשארה כפי שהיא . אין שיפור כלל",
      }) ?? ""
    assert.match(hints, /OPEN SERVICE CASE CONTINUATION \(528280449\)/)
    assert.match(hints, /Never.*lookup_order_status/i)
    assert.doesNotMatch(hints, /ORDER STATUS OPENING/)
  })

  it("lookup_order_status refuses shipping status mid open service case", async () => {
    const result = await executeLookupOrderStatus({
      body: "מאז הקנייה אנחנו שואבים 3 פעמים בשבוע. מידי פעם השואב מלא בפלומה",
      history: history528280449(),
      phone: "0500002343",
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /528280449/)
      assert.match(result.error, /lookup_misroute|OPEN SERVICE CASE/)
    }
  })
})
