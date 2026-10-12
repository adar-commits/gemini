import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPostPurchaseAltSizeBranchExchangeExplained,
  isPostPurchaseAltSizeNewRugShipmentAsk,
} from "@/lib/agents/post-purchase-alt-size"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BRANCH_REPLY =
  "*הום בוט :)*\nמעולה אורן, בסניף זה ללא עלות\nאפשר להגיע לכל סניף בימים א'-ה' (בשישי אין החלפות בסניפים)."

const SALES_HANDOFF =
  "*הום בוט :)*\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

function history534095173(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "הגיע אלי שטיח ואני רוצה להחליף מידה",
    },
    { role: "assistant", content: "*הום בוט :)*\nזו ההזמנה? (#78318)" },
    { role: "user", content: "כן" },
    { role: "assistant", content: SALES_HANDOFF },
    { role: "user", content: "40400025-240340" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבדקתי זמינות לדגם 40400025-240340: הדגם זמין כרגע להזמנה מוקדמת. צפי הגעה: 2026-10-29",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאורן, בהחלפה לא צריך לפתוח בקשה בפורטל ההחזרות… מה נוח לך יותר, בסניף או עם שליח?",
    },
    { role: "user", content: "בסניף" },
    { role: "assistant", content: BRANCH_REPLY },
  ]
}

/** Replay 534095173 — logistics ask after branch path must not duplicate human_sales. */
describe("exchange alt-size branch ship FAQ (534095173)", () => {
  it("detects branch exchange explained in thread", () => {
    const history = history534095173()
    assert.equal(isPostPurchaseAltSizeBranchExchangeExplained(history), true)
  })

  it("detects new-rug shipment question after branch + prior sales handoff", () => {
    const body = "ואתם תשלחו לי פשוט את השטיח החדש עם המידה שביקשתי?"
    assert.equal(
      isPostPurchaseAltSizeNewRugShipmentAsk(body, history534095173()),
      true
    )
  })

  it("emits branch ship FAQ hint forbidding duplicate human_sales", () => {
    const hints =
      buildConversationHints({
        history: history534095173(),
        body: "ואתם תשלחו לי פשוט את השטיח החדש עם המידה שביקשתי?",
      }) ?? ""
    assert.match(hints, /EXCHANGE ALT SIZE BRANCH SHIP FAQ \(534095173\)/)
    assert.match(hints, /action: reply/)
    assert.match(hints, /never.*duplicate.*human_sales/i)
    assert.doesNotMatch(hints, /POST-PURCHASE ALT SIZE:/)
  })
})
