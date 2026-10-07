import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { rememberOrdersLookup } from "@/lib/agents/order-lookup-cache"
import {
  findOrderByNumber,
  mapPriorityOrderRow,
  shouldRefuseKnownOrderLookup,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"

const TRACKING =
  "שלום אפרת\nhttps://tracking.carpetshop.co.il/track?orderID=SO26024002"
const ASK =
  "*הום בוט :)*\nנמשיך עם החלפה\n\nקודם נאתר את ההזמנה: היא רשומה על המספר שממנו מתכתבים? אם יש מספר הזמנה (למשל #76884), אפשר לשלוח אותו כאן."

const history: HistoryMessage[] = [
  { role: "assistant", content: TRACKING },
  { role: "user", content: "היי, שלום" },
  { role: "assistant", content: "*הום בוט :)*\nהיי, שלום! 😊 במה אפשר לעזור?" },
  { role: "user", content: "החלפה" },
  { role: "assistant", content: ASK },
]

describe("customer reference on tracked order 533606875", () => {
  const order = mapPriorityOrderRow({
    ORDNAME: "SO26024002",
    REFERENCE: "#77872",
    ORDSTATUSDES: "הושלם",
    ZPIT_DELSTATUSCODE: "6",
    ZPIT_DELSTATUSDES: "נמסרה",
    TOTPRICE: 295,
  })

  it("treats 77872 as the reference of the tracking order, not a missing ERP row", async () => {
    assert.equal(findOrderByNumber([order], "77872")?.raw.ORDNAME, "SO26024002")
    assert.equal(shouldRefuseKnownOrderLookup("77872", history), false)
    assert.equal(shouldRefuseKnownOrderLookup("מה נשמע", history), true)

    rememberOrdersLookup("0523851060", [order])
    const result = await executeLookupOrderStatus({
      body: "77872",
      phone: "+972523851060",
      history,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.match(result.reply, /77872/)
    assert.doesNotMatch(result.reply, /לא הצלחתי לשלוף|לא מצאתי הזמנה/)
  })

  it("hints to look the reference up instead of claiming the system failed", () => {
    const hints = buildConversationHints({
      body: "77872",
      history,
      whatsappPhone: "+972523851060",
    })
    assert.match(hints ?? "", /REFERENCE ON KNOWN ORDER \(533606875\)/)
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    assert.match(prompt, /533606875/)
  })
})
