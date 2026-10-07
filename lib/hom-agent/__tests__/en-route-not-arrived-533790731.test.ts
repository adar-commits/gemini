import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { isEnRouteNotYetArrivedUpdate } from "@/lib/hom-agent/en-route-follow-up"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { repairTruncatedBotReply } from "@/lib/hom-agent/truncated-output"

const EN_ROUTE_STATUS =
  "*הום בוט :)*\nבדקתי, איזה כיף! המשלוח הועמס לשליח ובדרכו אליך ברגעים אלה. נכון לתאריך 07/10/2026 בשעה 17:06\n\nשמחתי לעזור!"

const TRUNCATED_EN_ROUTE = `*הום בוט :)*
מבין שמחכים כבר שבוע. לפי המערכת המשלוח הועמס לשליח היום (07/10) ב-17:06, והוא עכשיו בדרך.

אין לנו שעה מדויקת. השליח יוצר קשר ביום האספקה, לפני שהוא מגי`

describe("en-route not yet arrived 533790731", () => {
  it("does not finish a cut en-route reply with a postponement or a new order lookup", () => {
    const repaired = repairTruncatedBotReply(TRUNCATED_EN_ROUTE)
    assert.doesNotMatch(repaired, /דחיית מסירה/)
    assert.doesNotMatch(repaired, /3076/)
    assert.doesNotMatch(repaired, /יש מספר הזמנה/)
    assert.match(repaired, /הסטטוס הסופי/)
    assert.match(repaired, /השליח יתקשר רגע לפני ההגעה/)
  })

  it("hints not to re-lookup when they say it has not arrived after an en-route status", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: EN_ROUTE_STATUS },
    ]
    assert.equal(isEnRouteNotYetArrivedUpdate("טרם הגיע", history), true)
    const hints = buildConversationHints({ body: "טרם הגיע", history })
    assert.match(hints ?? "", /EN ROUTE NOT YET ARRIVED \(533790731\)/)
    assert.match(hints ?? "", /בקשה לדחיית מסירה/)
    assert.match(hints ?? "", /הסטטוס הסופי/)
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    assert.match(prompt, /533790731/)
    assert.match(prompt, /Never\*\* write בקשה לדחיית מסירה/)
  })

  it("does not treat a first not-arrived line or a postponement ask as this follow-up", () => {
    assert.equal(isEnRouteNotYetArrivedUpdate("טרם הגיע", []), false)
    const history: HistoryMessage[] = [
      { role: "assistant", content: EN_ROUTE_STATUS },
    ]
    assert.equal(
      isEnRouteNotYetArrivedUpdate("אבקש להגיע מיום רביעי והלאה", history),
      false
    )
  })
})
