import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPhoneLookupConfirmPending,
  orderPhoneNamedByAssistant,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { shouldDeferStructuredPreTurnToLlm } from "@/lib/hom-agent/opening-turn-llm"
import type { HistoryMessage } from "@/lib/agents/types"

const OFFER = `*הום בוט :)*
היי! בשמחה אעזור לבדוק מתי השטיח אמור להגיע.

התמונה שצירפתם היא אישור התשלום, ובלי מספר הזמנה אני לא יכול לאתר את המשלוח. יש לכם מספר הזמנה? (למשל #36805 או SO26005938)

אם אין — אפשר לאתר לפי הטלפון שבהזמנה (0523128719). רק תאשרו ואבדוק.`

const FAILED_CHAT_SEARCH = `*הום בוט :)*
ניסיתי לאתר את ההזמנה לפי המספר שממנו אנחנו מתכתבים, אך לא הצלחתי למצוא אותה במערכת.

יש לכם מספר הזמנה? (למשל #36805 או SO26005938) זה יעזור לי לבדוק את הסטטוס במדויק.`

const REAL_CONFIRM = `*הום בוט :)*
האם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (050-4440304)
אם לא, אשמח לקבל את המספר הנכון.`

/** 533137123 — payment-image phone must be looked up with the model still on the turn. */
describe("payment image phone lookup 533137123", () => {
  const offered: HistoryMessage[] = [
    {
      role: "user",
      content: "ביצעתי את ההזמנה הזאת לפני כשבוע, ורציתי לדעת מתי השטיח אמור להגיע.",
    },
    { role: "assistant", content: OFFER },
  ]

  it("reads the payment phone, not the WhatsApp number", () => {
    assert.equal(
      orderPhoneNamedByAssistant(offered, "+972544661434"),
      "0523128719"
    )
  })

  it("does not treat a failed chat-number search as a phone-confirm question", () => {
    const history: HistoryMessage[] = [
      ...offered,
      { role: "user", content: "אשמח לאתר לפי הטלפון" },
      { role: "assistant", content: FAILED_CHAT_SEARCH },
    ]
    assert.equal(isPhoneLookupConfirmPending(history), false)
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(history, {
        text: "אשמח לאתר לפי הטלפון: 0523128719",
        media: [],
      }),
      true
    )
  })

  it("still binds a real האם-רשומה question", () => {
    const history: HistoryMessage[] = [{ role: "assistant", content: REAL_CONFIRM }]
    assert.equal(isPhoneLookupConfirmPending(history), true)
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(history, { text: "כן", media: [] }),
      false
    )
  })

  it("hints to look up the named phone and keep the model on the turn", () => {
    const hints = buildConversationHints({
      body: "אשמח לאתר לפי הטלפון",
      history: offered,
      whatsappPhone: "+972544661434",
    })
    assert.match(hints ?? "", /533137123/)
    assert.match(hints ?? "", /0523128719/)
    assert.match(hints ?? "", /lookup_order_status/)
  })
})
