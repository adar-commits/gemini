import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { isShippingAddressChangeAsk } from "@/lib/agents/post-purchase-alt-size"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const RECEIPT = `שלום יותם כהן, 👋 תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/d953e7c4-0547-4694-8a53-644162652ffc למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן: https://tracking.carpetshop.co.il/track?orderID=SO26024875`

const OPENING =
  "אני צריך לשנות כתובת זה טעות תשנו לאסא 40 קרית גת\nותוך כמה זמן זה מגיע?"

const BOT_REPLY =
  "*הום בוט :)* היי יותם, אני לא יכול לשנות את הכתובת מכאן, וזה גם לא תמיד אפשרי. זה תלוי בשלב שבו נמצא המשלוח. אם ההזמנה כבר אצל חברת השליחויות, אפשר לשנות כתובת בתשלום, דרך הוואטסאפ 077-9725055 או בטלפון *3076. כדי לבדוק מתי זה מגיע: אתה מתכוון להזמנה SO26024875 מהקבלה שקיבלת?"

const FOLLOW_UP = "הזמנתי עכשיו עשיתי טעות"

/** 534127311 — address mistake + ETA: confirm reply must lookup SO26024875, not hand off without status. */
describe("address change with delivery ETA 534127311", () => {
  const history: HistoryMessage[] = [
    { role: "assistant", content: RECEIPT },
    { role: "user", content: OPENING },
    { role: "assistant", content: BOT_REPLY },
  ]

  it("recognizes known order confirm and address change in thread", () => {
    assert.equal(orderIdGivenInThread(history), "SO26024875")
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(isShippingAddressChangeAsk(FOLLOW_UP, history), true)
  })

  it("hints lookup_order_status before address handoff", () => {
    const hints = buildConversationHints({ body: FOLLOW_UP, history }) ?? ""
    assert.match(hints, /534127311/)
    assert.match(hints, /SO26024875/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /ADDRESS \+ ETA COMPOUND/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never human_service without lookup/)
  })
})
