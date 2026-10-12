import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  mapPriorityOrderRow,
  requiresOrderStatusServiceHandoff,
  shouldDeferUnknownDeliveryStatusHandoff,
} from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildDeliveryEstimatePolicyReply } from "@/lib/agents/delivery-estimate-policy"
import { UNKNOWN_DELIVERY_STATUS_ETA_DEFERRED } from "@/lib/agents/delivery-status-terminology"

const OPENER = "שלום אבקש להבין מתי יסופק לי השטיח שהזמנתי"
const BOT_CONFIRM =
  "*הום בוט :)*\nמצאתי הזמנה שבוצעה לפני 49 ימים בקרית אתא, על סך 1,645 ש״ח. זו ההזמנה? (מס׳ הזמנה SO26020345)"

/** Replay 530185940 — ETA confirm + unknown delivery code must not promise transfer on action reply. */
describe("shipping unknown status defer 530185940", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENER },
    { role: "assistant", content: BOT_CONFIRM },
  ]

  const unknownOrder = mapPriorityOrderRow({
    ORDNAME: "SO26020345",
    REFERENCE: "#75500",
    ZPIT_DELSTATUSCODE: "15",
    ZPIT_DELSTATUSDES: "הוקפא זמנית",
    ORDSTATUSDES: "הושלם",
    ZPIT_UDATE: "2026-08-18T00:00:00+03:00",
  })

  it("defers auto-handoff on shipping ETA order confirm", () => {
    assert.equal(shouldDeferUnknownDeliveryStatusHandoff(history), true)
    assert.equal(requiresOrderStatusServiceHandoff(unknownOrder), true)
  })

  it("uses ETA policy copy without הפנייה תועבר on defer path", () => {
    const reply = buildDeliveryEstimatePolicyReply({
      ...unknownOrder,
      statusDescription: UNKNOWN_DELIVERY_STATUS_ETA_DEFERRED,
    })
    assert.match(reply, /לא ניתן להציג כרגע סטטוס משלוח/)
    assert.doesNotMatch(reply, /הפנייה תועבר להמשך טיפול/)
    assert.match(reply, /האם להעביר לנציג שירות/)
    assert.match(reply, /לא ניתן לחשב צפי אספקה/)
  })
})
