import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { inferHumanHandoffAction } from "@/lib/agents/off-topic"
import { isConfirmationPending } from "@/lib/agents/sales-intake"
import { isServiceHandoffSummaryPending } from "@/lib/agents/service-intake"
import { resolveCrmDepartmentForTurn } from "@/lib/crm/conversation-department"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"

/** Replay 364573990 / אלינה פרי — service summary confirm must not assign יועץ מכירות. */
describe("service summary confirm 364573990", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "שלום, ביצעתי הזמנה ב-5.09.2026 ועדיין לא קיבלתי את השטיחים. אודה לבדיקתכם. אלינה פרי \nמספר הזמנה 75477",
      agent: null,
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nשלום אלינה מבין שההזמנה בוצעה ב-5.09.2026 והשטיחים עדיין לא הגיעו אליכם — אני כאן לטפל בזה.\n\nאז מסכם את הפנייה עבור נציג שירות הלקוחות שלנו:\n• מס׳ הזמנה: 75477\n• ההזמנה בוצעה בתאריך 5.09.2026\n• הלקוחה טרם קיבלה את השטיחים\n• מבקשת בדיקת סטטוס ועדכון מועד אספקה\n\nאני צודק?",
      agent: "faq",
    },
  ]

  it("treats אני צודק? after service recap as service, not sales confirm", () => {
    assert.ok(isServiceHandoffSummaryPending(history))
    assert.equal(isConfirmationPending(history), false)
    assert.equal(inferHumanHandoffAction(history, null), "human_service")
  })

  it("assigns human_service on כן — not יועץ מכירות", () => {
    const result = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history,
      customerName: "אלינה פרי",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.match(result.reply, /נציג שירות|שירות/)
    assert.doesNotMatch(result.reply, /יועץ מכירות/)
    assert.equal(
      resolveCrmDepartmentForTurn({ history, body: "כן" })?.department,
      "service"
    )
  })

  it("does not steal a sales אני צודק? recap to service", () => {
    const salesHistory: HistoryMessage[] = [
      { role: "user", content: "אין בע״ח" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאוקיי, אז לסיכום אני מחפש עבורכם שטיח לסלון בכל סגנון, ללא בעלי חיים. אני צודק?",
        agent: "sales",
      },
    ]
    assert.equal(isServiceHandoffSummaryPending(salesHistory), false)
    assert.equal(isConfirmationPending(salesHistory), true)
    const result = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history: salesHistory,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
  })
})
