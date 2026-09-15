import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveCrmDepartmentForTurn } from "@/lib/crm/conversation-department"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesIntakePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const SHIPPING_THEN_STATUS: HistoryMessage[] = [
  { role: "user", content: "היי אשמח לדעת מתי מגיע המשלוח שלי ?" },
  {
    role: "assistant",
    content:
      "*הום בוט :)*\nקודם אמצא את ההזמנה… האם היא רשומה על המספר ממנו אני מתכתב כרגע?",
  },
  { role: "user", content: "כן" },
  {
    role: "assistant",
    content:
      "*הום בוט :)*\nבדקתי, איזה כיף! המשלוח הועמס לשליח…\n\nאפשר לעזור במשהו נוסף?",
  },
]

const SALES_PIVOT_MESSAGE =
  "אשמח לקבל תמונה של שטיח לולאות בצבע אפור בהיר"

const AFTER_SALES_INTAKE_QUESTION: HistoryMessage[] = [
  ...SHIPPING_THEN_STATUS,
  { role: "user", content: "תודה" },
  {
    role: "assistant",
    content: "*הום בוט :)*\nShani, בשמחה! 😊 במה עוד אוכל לעזור?",
  },
  { role: "user", content: SALES_PIVOT_MESSAGE },
  {
    role: "assistant",
    content:
      "*הום בוט :)*\n…אפשר לקשר ליועץ מכירות…\n\nלאיזה חלל בבית מיועד השטיח?",
  },
]

/** Replay 531404146 / 0509640100 — service shipping thread pivots to sales. */
describe("service to sales pivot (531404146)", () => {
  it("hints sales department on product request after delivered status", () => {
    const history: HistoryMessage[] = [
      ...SHIPPING_THEN_STATUS,
      { role: "user", content: "תודה" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nבשמחה! במה עוד אוכל לעזור?",
      },
    ]
    const hints = buildConversationHints({
      body: SALES_PIVOT_MESSAGE,
      history,
      phone: "0509640100",
    })
    assert.match(hints ?? "", /MID-THREAD PIVOT \(service→sales\)/i)
    assert.match(hints ?? "", /crm_department.*sales/i)
  })

  it("resolves structured sales department once intake question was sent", () => {
    const resolved = resolveCrmDepartmentForTurn({
      history: AFTER_SALES_INTAKE_QUESTION,
      body: "סלון",
    })
    assert.deepEqual(resolved, { department: "sales", source: "structured" })
  })

  it("does not bind bare כן to stale sales quiz when order phone confirm is pending", () => {
    const history: HistoryMessage[] = [
      ...AFTER_SALES_INTAKE_QUESTION,
      { role: "user", content: "הי לא קיבלתי את המשלוח" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nקודם אמצא את ההזמנה… האם היא רשומה על המספר ממנו אני מתכתב כרגע?",
      },
    ]
    const result = runStructuredSalesIntakePreTurn({
      turn: { text: "כן", media: [] },
      history,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "skip")
  })

  it("allows LLM flip back to service on delivery complaint", () => {
    const resolved = resolveCrmDepartmentForTurn({
      llmDepartment: "service",
      history: AFTER_SALES_INTAKE_QUESTION,
      body: "הי לא קיבלתי את המשלוח",
    })
    assert.deepEqual(resolved, { department: "service", source: "llm" })
  })
})
