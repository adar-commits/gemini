import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isCheckoutPaymentSplitCardRefundOnlyThread,
  isCheckoutPaymentSplitRefundChaseFollowUp,
} from "@/lib/agents/payment-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const HANDOFF_REFUND_ONLY =
  "*הום בוט :)* דורית, הבנתי. ההזמנה חויבה גם בכרטיס האשראי וגם ב-BUYME, ואת רוצה רק שהחיוב בכרטיס יזוכה. מעולה, העברתי את השיחה לנציג שירות."

const LONG_CHASE =
  "עשיתי הזמנה ב 09/10 של שטיח דרך ביימי השטיח עלה 534 היה לי שובר 500 הייתם צריכים לחייב את האשראי שלי ב 34 אבל חייבתם בכל הסכום 534 בנוסף חייבתם גם את הביימי ב500 פניתי אליכם בוואטסאפ חזרתם אלי אמרתם שאתם רואים שאכן בוצעו חיובים כפולים אבל עד עכשיו לא זיכיתם תדאגו לזכות בהקדם דורית0528907350 כרטיס שמסתיים ב 8012"

const SHORT_CHASE = "חייבתם ולא זיכיתם את הכרטיס"

function historyAfterRefundHandoff(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "רציתי לשלם ב-BUYME רק את ה-34 שקל חייבת מאת הכל באשראי אני צריכה שתעשו ביטול עסקה ועסקה מחדש",
    },
    { role: "user", content: "‏זה לא ביטול הזמנה" },
    { role: "user", content: "‏היא כבר כיבה את המים היא רק לא זכתה את הכרטיס" },
    { role: "user", content: "רק תזכו את הכרטיס" },
    { role: "user", content: "כי חייבים גם את הכרטיס וגם את ביימי" },
    { role: "assistant", content: HANDOFF_REFUND_ONLY },
  ]
}

/** Replay 534579658 — long refund chase after BUYME/card split handoff must bind human_service. */
describe("checkout payment split refund chase 534579658", () => {
  it("detects card-refund-only pivot in thread", () => {
    assert.equal(isCheckoutPaymentSplitCardRefundOnlyThread(historyAfterRefundHandoff()), true)
  })

  it("detects long double-charge re-escalation after handoff", () => {
    assert.equal(
      isCheckoutPaymentSplitRefundChaseFollowUp(historyAfterRefundHandoff(), LONG_CHASE),
      true
    )
    assert.equal(
      isCheckoutPaymentSplitRefundChaseFollowUp(historyAfterRefundHandoff(), SHORT_CHASE),
      true
    )
  })

  it("hints CHECKOUT PAYMENT SPLIT REFUND CHASE with human_service", () => {
    const hints =
      buildConversationHints({
        history: historyAfterRefundHandoff(),
        body: LONG_CHASE,
      }) ?? ""
    assert.match(hints, /CHECKOUT PAYMENT SPLIT REFUND CHASE \(534579658\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /never.*ביטול ההזמנה/i)
    assert.doesNotMatch(hints, /PRE-DELIVERY CANCEL HANDOFF RESPONSE WAIT/)
  })
})
