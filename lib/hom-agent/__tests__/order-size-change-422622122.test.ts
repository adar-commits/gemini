import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOrderModificationRequest } from "@/lib/agents/inquiry-intent"
import {
  buildOrderModificationAwareStatusReply,
  isOrderModificationInThread,
  mapPriorityOrderRow,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING: HistoryMessage[] = [
  { role: "user", content: "שלום" },
  {
    role: "assistant",
    content: "*הום בוט :)*\nשלום נילי! 😊 במה אפשר לעזור?",
  },
]

const SIZE_CHANGE_WITH_ORDER =
  "עשיתי היום הזמנה בחנות ואני רוצה לשנות את הגודל של אחד השטיחים. מספר הזמנה: SO26024431"

const PACKAGING_ORDER = mapPriorityOrderRow({
  ORDNAME: "SO26024431",
  REFERENCE: "#24431",
  ZPIT_DELSTATUSCODE: "1",
  ORDSTATUSDES: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  ZPIT_UDATE: "2026-10-01T14:00:00+03:00",
})

/** Replay 422622122 — size change with SO must not warm-close on packaging status only. */
describe("order size change before ship 422622122", () => {
  it("detects size modification in opening message", () => {
    assert.equal(isOrderModificationRequest(SIZE_CHANGE_WITH_ORDER), true)
    assert.equal(
      isOrderModificationInThread(OPENING, SIZE_CHANGE_WITH_ORDER),
      true
    )
  })

  it("status reply addresses size change and offers sales handoff", () => {
    const history = [...OPENING, { role: "user", content: SIZE_CHANGE_WITH_ORDER }]
    const reply = buildOrderModificationAwareStatusReply(
      PACKAGING_ORDER,
      history,
      SIZE_CHANGE_WITH_ORDER
    )
    assert.match(reply, /בדקתי,/)
    assert.match(reply, /לשנות את ההזמנה/)
    assert.match(reply, /יועץ מכירות/)
    assert.doesNotMatch(reply, /שמחתי לעזור/)
  })

  it("hints forbid warm-close after modification lookup", () => {
    const hints = buildConversationHints({
      body: SIZE_CHANGE_WITH_ORDER,
      history: OPENING,
      phone: "0547497814",
    })
    assert.match(hints ?? "", /ORDER MODIFICATION.*422622122/)
    assert.match(hints ?? "", /never.*שמחתי לעזור/i)
    assert.match(hints ?? "", /human_sales/)
  })
})
