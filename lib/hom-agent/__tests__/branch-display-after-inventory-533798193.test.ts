import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasPendingBranchDisplayQuestion,
  isActiveInventoryThread,
} from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** 533798193 — display-at-branch ask + SKU stock check; bot must not warm-close after inventory. */
describe("branch display after inventory 533798193", () => {
  const opening =
    "היי, אשמח לדעת אם יש אצלכם בתצוגה בראשון לציון את השטיח דגם סידני בצבעים שונים🙂"

  const historyAfterStock: HistoryMessage[] = [
    { role: "user", content: opening, agent: null },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי מעיין! אני לא רואה מה מוצג בתצוגה בסניף ובאילו צבעים. את זה יועץ מכירות יכול לברר מול הסניף. אם יש לכם מק״ט של צבע מסוים של סידני מהאתר (לדוגמה: 31503138-200290), אבדוק לכם עכשיו אם יש ממנו מלאי בסניף ראשון לציון. לחלופין, אעביר את השאלה ליועץ מכירות. מה מתאים לכם?",
      agent: "faq",
    },
    { role: "user", content: "31502091-200290", agent: null },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בדקתי זמינות לדגם 31502091-200290: הדגם זמין כרגע להזמנה מוקדמת. צפי הגעה: 2026-11-15 שמחתי לעזור!",
      agent: "faq",
    },
  ]

  it("detects open display question from bot and follow-up", () => {
    assert.equal(hasPendingBranchDisplayQuestion(opening, []), true)
    assert.equal(
      hasPendingBranchDisplayQuestion("אני רוצה לדעת אם קיים בתצוגה גם", historyAfterStock),
      true
    )
  })

  it("flags active inventory thread after stock lookup", () => {
    assert.equal(isActiveInventoryThread(historyAfterStock), true)
  })

  it("hints not to warm-close and to offer human_sales for display", () => {
    const body = "אני רוצה לדעת אם קיים בתצוגה גם"
    const hints = buildConversationHints({
      history: historyAfterStock,
      body,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /DISPLAY OPEN \(533798193\)/)
    assert.match(hints!, /never.*warm-close/i)
    assert.match(hints!, /human_sales/)
  })
})
