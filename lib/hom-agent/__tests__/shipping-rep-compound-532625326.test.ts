import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { customerExplicitlyRequestsHuman } from "@/lib/agents/kb-self-service-faq"
import { isOrderDeliveryStatusQuestion } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const COMPOUND =
  "כן. מתי יגיע השטיח? אני ממתינה הרבה מאוד זמן. נציג אנושי בבקשה."

const BAD_END =
  "*הום בוט :)* בדקתי, איזה כיף! המשלוח הועמס לשליח ובדרכו אליך ברגעים אלה. נכון לתאריך 12/10/2026 בשעה 09:16 שמחתי לעזור! 😊"

/** Replay 532625326 — shipping ETA + explicit rep in one turn must not close with action end. */
describe("shipping rep compound 532625326", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "??? שלום" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי משי, שלום! סליחה על ההמתנה, אני כאן. מדובר בהזמנה #77069, או שיש משהו אחר שאפשר לעזור בו?",
    },
  ]

  it("detects compound rep + delivery ask", () => {
    assert.equal(customerExplicitlyRequestsHuman(COMPOUND), true)
    assert.equal(isOrderDeliveryStatusQuestion(COMPOUND), true)
  })

  it("hints human_service binding, not warm-close end", () => {
    const hints = buildConversationHints({
      history,
      body: COMPOUND,
      whatsappPhone: "+972506573346",
    })
    assert.match(hints, /EXPLICIT REP \+ SHIPPING ETA \(532625326\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never.*action: end/)
  })

  it("bad FAQ end reply is not the expected handoff outcome", () => {
    assert.doesNotMatch(BAD_END, /מעביר|העברתי/)
    assert.match(BAD_END, /שמחתי לעזור/)
  })
})
