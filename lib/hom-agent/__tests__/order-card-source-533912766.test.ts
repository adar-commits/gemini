import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { requiresOrderIdentification, orderIdGivenInThread } from "@/lib/agents/order-lookup"
import { isServicePhotoAnalysisContext } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "למה לא רשום הדגם שהזמנתי? איך אני אהיה בטוחה שאקבל את מה שהזמנתי? רשמתי את המק״ט באתר ולא קיבלתי פריט [media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533662146/OPYA8MQEGURE2I1TRSDH7MP6XZUX6PDE.jpg]"

const BAD_REPLY =
  "*הום בוט :)*\nהיי לימור, קיבלתי את התמונה. מבין את החשש, חשוב לוודא שהדגם שבחרת הוא זה שיגיע. אני יכול לאתר את ההזמנה ולשלוח לך את פירוט הפריטים שרשומים בה. מדובר בהזמנה SO26024519 שמופיעה בקישור המעקב?"

/** Replay 533912766 — phone lookup order card must explain source, not invent tracking link. */
describe("order card source honesty (533912766)", () => {
  it("detects verify-model/SKU photo opening as order identification", () => {
    assert.equal(requiresOrderIdentification(OPENING, []), true)
    assert.equal(isServicePhotoAnalysisContext([], OPENING), true)
  })

  it("emits order-card source hint before any order id is in the thread", () => {
    const history: HistoryMessage[] = [{ role: "user", content: OPENING }]
    assert.equal(orderIdGivenInThread(history), null)
    const hints = buildConversationHints({ history, body: OPENING }) ?? ""
    assert.match(hints, /ORDER CARD SOURCE \(533912766\)/)
    assert.match(hints, /לפי מספר הטלפון/)
    assert.match(hints, /never "קישור המעקב"/)
  })

  it("the bad reply attributed the order to a tracking link the customer never sent", () => {
    assert.match(BAD_REPLY, /קישור המעקב/)
    assert.doesNotMatch(BAD_REPLY, /לפי מספר הטלפון/)
  })
})
