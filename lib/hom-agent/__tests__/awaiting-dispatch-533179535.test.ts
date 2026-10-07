import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildDeliveryEstimatePolicyReply } from "@/lib/agents/delivery-estimate-policy"
import {
  buildOrderStatusReply,
  mapPriorityOrderRow,
  preferAwaitingDispatchOverSelfPickupDraft,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const SELF_PICKUP_NOTICE =
  "היי עילי סידי\nהזמנתך SO26023319 התקבלה אצלנו בהצלחה.\n\nחשוב לציין שההזמנה עדיין אינה מוכנה לאיסוף — יש להמתין עד שנשלח אליך הודעה נוספת ברגע שההזמנה תיארז ותהיה מוכנה.\n\nכתובת לאיסוף עצמי:\nמחסני החברה נמצאים באיירפורט סיטי"

function row(partial: Parameters<typeof mapPriorityOrderRow>[0]) {
  return mapPriorityOrderRow(partial)
}

describe("awaiting dispatch not self-pickup draft 533179535", () => {
  const draft = row({
    ORDNAME: "SO26023319",
    ORDSTATUSDES: "טיוטא",
    ZPIT_DELSTATUSCODE: "21",
    ZPIT_DELSTATUSDES: "איסוף עצמי - ממתין",
  })
  const dispatch = row({
    ORDNAME: "SO26024845",
    ORDSTATUSDES: "הושלם",
    ZPIT_DELSTATUSCODE: "4",
    ZPIT_DELSTATUSDES: "ממתין להפצה",
    ZPIT_DELIVERYDES: "מסירה ללקוח",
    ZPIT_UDATE: "2026-10-07T17:04:00+03:00",
  })

  it("answers status 4 ממתין להפצה instead of the old self-pickup draft", () => {
    const picked = preferAwaitingDispatchOverSelfPickupDraft(
      draft,
      [draft, dispatch],
      "מתי מגיעה ההזמנה"
    )
    assert.equal(picked.raw.ORDNAME, "SO26024845")
    const reply = buildOrderStatusReply(picked)
    assert.match(reply, /ממתין להפצה/)
    assert.doesNotMatch(reply, /טרם מוכנה לאיסוף עצמי/)
    assert.doesNotMatch(reply, /שוייך לשליח/)
    const estimate = buildDeliveryEstimatePolicyReply(picked)
    assert.match(estimate, /ממתין להפצה/)
    assert.doesNotMatch(estimate, /כבר אצל חברת השליחויות/)
  })

  it("keeps the draft when the customer typed that order number", () => {
    const picked = preferAwaitingDispatchOverSelfPickupDraft(
      draft,
      [draft, dispatch],
      "SO26023319 מתי מגיעה"
    )
    assert.equal(picked.raw.ORDNAME, "SO26023319")
  })

  it("hints not to reuse the automated self-pickup SO", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: SELF_PICKUP_NOTICE },
    ]
    const hints = buildConversationHints({
      body: "מתי מגיעה ההזמנה",
      history,
    })
    assert.match(hints ?? "", /AWAITING DISPATCH \(533179535\)/)
    assert.match(hints ?? "", /ממתין להפצה/)
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    assert.match(prompt, /533179535/)
    assert.match(prompt, /status \*\*4\*\* is \*\*ממתין להפצה\*\*/)
  })
})
