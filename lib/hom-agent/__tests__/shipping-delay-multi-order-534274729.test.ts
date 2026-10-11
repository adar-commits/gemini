import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isShippingThreadFromHistory } from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "היי הזמנתי 2 שטיחים לפני שבוע ועדיין לא הגיעו. זמן האספקה אמור להיות 4 ימי עסקים לפי מה שאני מבין נכון. ההזמנות על שם אוראל ושנקו"

const BOT_ASK =
  "*הום בוט :)*\nהיי ואדים, אתה צודק, שטיחים אמורים להגיע תוך 4 ימי עסקים, ושבוע זה כבר יותר מזה. בקישור המעקב שקיבלת מופיעה הזמנה SO26023971. האם שני השטיחים בהזמנה הזאת?"

const TWO_ORDERS_BODY =
  "יש הזמנה so26023885 ויש את so26023971\nראית?\n???"

const BAD_RETURN_SUMMARY =
  "*הום בוט :)*\nהבנתי, בקשת ההחזרה כבר פתוחה ואתם מחכים כבר שבוע שהשליח יאסוף את המוצר מהבית."

function historyThroughTwoOrders(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: BOT_ASK },
  ]
}

/** Replay 534274729 — multi-order shipping delay must not pivot to return pickup. */
describe("shipping delay multi-order 534274729", () => {
  const history = historyThroughTwoOrders()

  it("detects shipping delay opening and thread", () => {
    assert.equal(isShippingStatusQuestion(OPENING), true)
    assert.equal(isShippingThreadFromHistory(history), true)
  })

  it("hints delivery lookup for two SO numbers — not return pickup", () => {
    const hints = buildConversationHints({ body: TWO_ORDERS_BODY, history }) ?? ""
    assert.match(hints, /534274729/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never.*return-pickup|בקשת החזרה/i)
    assert.doesNotMatch(hints, /RETURN PICKUP WAIT/i)
  })

  it("bad return-pickup summary is the regression we block", () => {
    assert.match(BAD_RETURN_SUMMARY, /בקשת ההחזרה/)
    assert.match(BAD_RETURN_SUMMARY, /יאסוף/)
  })

  it("hints dual lookup on follow-up when two SO already in thread (Oct 11)", () => {
    const longHistory: HistoryMessage[] = [
      ...historyThroughTwoOrders(),
      { role: "user", content: TWO_ORDERS_BODY },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאין כאן שום החזרה: הזמנת 2 שטיחים בשתי הזמנות SO26023885 ו-SO26023971.",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבוקר טוב. אם זה בקשר לשני השטיחים מההזמנות SO26023885 ו-SO26023971, אני יכול לבדוק עכשיו מה מצב שתיהן.",
      },
    ]
    const body = "רצוי מאוד כבר עברו שבועיים והשטיחים טרם הגיעו"
    const hints = buildConversationHints({ body, history: longHistory }) ?? ""
    assert.match(hints, /MULTI-ORDER STATUS CHECK \(534274729\)/)
    assert.match(hints, /once per SO/)
  })

  it("hints dual lookup when customer asks about the second carpet", () => {
    const longHistory: HistoryMessage[] = [
      ...historyThroughTwoOrders(),
      { role: "user", content: TWO_ORDERS_BODY },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי — הזמנה מוקדמת פורמולה 1 SO26023971, צפי 29/10/2026.",
      },
    ]
    const body = "יש 2 שטיחים זה אמרת לי על השטיח הראשון מה עם השטיח השני?"
    const hints = buildConversationHints({ body, history: longHistory }) ?? ""
    assert.match(hints, /MULTI-ORDER STATUS CHECK \(534274729\)/)
  })
})
