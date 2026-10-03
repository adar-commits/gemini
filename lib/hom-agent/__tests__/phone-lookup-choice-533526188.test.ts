import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isChannelPhoneSelfReference,
  isOrderNumberRequestPending,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const LOOKUP_OFFER =
  "*הום בוט :)*\nאני יכול לבדוק לך את זה כאן לפי סטטוס ההזמנה. לבדוק לפי הטלפון שממנו את כותבת, או שיש לך מספר הזמנה?"

/** 533526188 — address-change thread: phone lookup choice must run lookup, not "no status". */
describe("phone lookup choice after order-id ask 533526188", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nשירה, לא תמיד אפשר לעדכן כתובת. זה תלוי בשלב שבו נמצא המשלוח. אם ההזמנה כבר נמסרה לחברת השליחויות, אפשר לשנות את הכתובת בתשלום, ישירות מול חברת השליחויות: בוואטסאפ 077-9725055 או בטלפון ‎*3076. בכיף, ערב טוב",
    },
    { role: "user", content: "איך אדע אם היא נמסרה" },
    { role: "assistant", content: LOOKUP_OFFER },
  ]

  const body = "אפשר לפי הטלפון תודה"
  const phone = "+972501234567"

  it("detects order-number ask pending and phone choice with thanks", () => {
    assert.equal(isOrderNumberRequestPending(history), true)
    assert.equal(isChannelPhoneSelfReference(body), true)
    assert.equal(isChannelPhoneSelfReference("אפשר לפי הטלפון"), true)
  })

  it("hints lookup_order_status instead of claiming no status access", () => {
    const hints = buildConversationHints({ body, history, whatsappPhone: phone }) ?? ""
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /533526188/)
    assert.match(hints, /Never claim you cannot see status/)
  })

  it("structured pre-turn handles phone choice on address-update thread", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: body, media: [] },
      history,
      phone,
    })
    assert.notEqual(result.kind, "skip")
    if (result.kind === "handled") {
      assert.doesNotMatch(result.reply, /אין לי אפשרות לראות/)
      assert.doesNotMatch(result.reply, /לא הבנתי/)
    }
  })
})
