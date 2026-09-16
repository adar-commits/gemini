import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildCourierMetadataUnavailableReply,
  buildPostOrderLookupContinuationReply,
  isExplicitHumanRequest,
  isOrderDeliveryStatusQuestion,
  isPostOrderShippingFollowUp,
} from "@/lib/agents/order-lookup"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import { runStructuredPostOrderCompletedPreTurn } from "@/lib/hom-agent/pre-turn"

const POST_ORDER_MENU_RE = /כבר מצאנו את ההזמנה.*ביטול, החזרה/

function historyAfterStatusDelivered(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "ברצוני לדעת מתי יסופק לי השטיח שהזמנתי",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-6450649)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני 31 ימים בראשון לציון על סך 1,550 ש׳׳ח נכון? (מס׳ הזמנה ⁦SO26019324⁩)",
    },
    { role: "user", content: "נכון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבדקתי, ההזמנה נארזה ומוכנה לאיסוף על ידי חברת השליחויות. נכון לתאריך 09/09/2026 בשעה 15:26\n\nשמחתי לעזור!",
    },
  ]
}

/** Replay 529503176 — post-order shipping follow-ups must not show action menus. */
describe("order status follow-up (529503176)", () => {
  const phone = "+972526450649"
  const history = historyAfterStatusDelivered()

  it("detects יגיע / יסופק phrasing as delivery status", () => {
    assert.equal(
      isOrderDeliveryStatusQuestion("אני רוצה לדעת מתי יגיע השטיח שהזמנתי"),
      true
    )
    assert.equal(isOrderDeliveryStatusQuestion("תסופק"), true)
  })

  it("treats courier and delay lines as post-order shipping follow-ups", () => {
    assert.equal(isPostOrderShippingFollowUp("מי חברת השליחויות", history), true)
    assert.equal(isPostOrderShippingFollowUp("עבר שבוע", history), true)
    assert.equal(
      isPostOrderShippingFollowUp("אני רוצה לדעת מתי יגיע השטיח שהזמנתי", history),
      true
    )
  })

  it("binds העברה לנציג as explicit rep request", () => {
    assert.equal(isExplicitHumanRequest("העברה לנציג"), true)
  })

  it("never returns the unsolicited cancel/return menu", async () => {
    for (const body of [
      "מי חברת השליחויות",
      "עבר שבוע",
      "תסופק",
      "אני רוצה לדעת מתי יגיע השטיח שהזמנתי",
    ]) {
      const reply = await buildPostOrderLookupContinuationReply({
        body,
        history,
        whatsappPhone: phone,
      })
      assert.notEqual(reply, null, body)
      assert.doesNotMatch(reply!, POST_ORDER_MENU_RE)
    }
  })

  it("answers courier question without action menu", async () => {
    const reply = await buildPostOrderLookupContinuationReply({
      body: "מי חברת השליחויות",
      history,
      whatsappPhone: phone,
    })
    assert.notEqual(reply, null)
    assert.match(reply!, /אין לי במערכת את שם חברת השליחויות/)
    assert.doesNotMatch(reply!, POST_ORDER_MENU_RE)
  })

  it("structured pre-turn hands off on העברה לנציג", async () => {
    const result = await runStructuredPostOrderCompletedPreTurn({
      turn: { text: "העברה לנציג", media: [] },
      history,
      phone,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.match(result.reply, /העברתי/)
  })

  it("lookup tool defers to LLM instead of action menu for unrelated post-order text", async () => {
    const result = await executeLookupOrderStatus({
      body: "יש לכם גם שטיחים לילדים?",
      history,
      phone,
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /ORDER LOOKUP COMPLETED/)
    assert.doesNotMatch(result.error, POST_ORDER_MENU_RE)
  })
})
