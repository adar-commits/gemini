import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildMissingProductChoicePrompt,
  isMissingProductChoicePending,
  mapPriorityOrderRow,
  matchMissingProductFromThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** Replay 533699320 — missing stickers already stated; skip redundant product pick after confirm. */
describe("missing item already named (533699320)", () => {
  const order = mapPriorityOrderRow({
    ORDNAME: "SO26024186",
    REFERENCE: "#77947",
    TOTPRICE: 1200,
    BRANCHNAME: "3000",
    ORDERITEMS_SUBFORM: [
      {
        PARTNAME: "STICKERS-001",
        PDES: "מדבקות סיליקון למניעת החלקה",
        VPRICE: 49,
      },
      {
        PARTNAME: "KILIM-18",
        PDES: "קילים סקנדינבי 18 כחול/ורוד/אפור 160*230",
        VPRICE: 890,
      },
    ],
  })

  const items = order.lineItems ?? []

  const historyBeforeConfirm: HistoryMessage[] = [
    { role: "user", content: "שלום" },
    { role: "user", content: "קיבלתי היום את ההזמנה" },
    {
      role: "user",
      content: "הגיע רק סט אחד של מדבקות סיליקון, שילמתי עבור שני סטים",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nשלום, מצטער, הגיע רק סט אחד של מדבקות הסיליקון במקום שניים. נטפל בזה כדי שהסט החסר יגיע. מדובר בהזמנה SO26024186 מהקישור למעקב שנשלח לכם?",
      agent: "service",
    },
    { role: "user", content: "אכן" },
  ]

  it("binds missing product from thread without numbered pick", () => {
    const picked = matchMissingProductFromThread(historyBeforeConfirm, "אכן", items)
    assert.equal(picked?.name, "מדבקות סיליקון למניעת החלקה")
    assert.equal(picked?.sku, "STICKERS-001")
  })

  it("does not treat confirm-only turn as missing product pick pending", () => {
    const wrongReply = buildMissingProductChoicePrompt(order, items)
    const historyWithWrongPick: HistoryMessage[] = [
      ...historyBeforeConfirm,
      { role: "assistant", content: wrongReply, agent: "service" },
    ]
    assert.ok(isMissingProductChoicePending(historyWithWrongPick))
    assert.ok(matchMissingProductFromThread(historyBeforeConfirm, "אכן", items))
  })

  it("hint teaches skip numbered pick when product already named", () => {
    const hints = buildConversationHints({
      history: historyBeforeConfirm,
      body: "אכן",
      whatsappPhone: "+972500000000",
    })
    assert.ok(hints)
    assert.match(hints, /skip numbered pick/i)
    assert.match(hints, /already named the missing product/i)
  })

  it("still needs pick when missing product was not named in thread", () => {
    const vagueHistory: HistoryMessage[] = [
      { role: "user", content: "קיבלתי היום חלק מההזמנה" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nזו ההזמנה SO26024186 — נכון?",
        agent: "service",
      },
    ]
    assert.equal(matchMissingProductFromThread(vagueHistory, "כן", items), null)
  })
})
