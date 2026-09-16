import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesIntakePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

afterEach(() => {
  delete process.env.SALES_INTAKE_MODE
})

describe("sales intake pre-turn (532390988 — placeholder stub)", () => {
  const historyBeforePetsAnswer: HistoryMessage[] = [
    {
      role: "user",
      content: "היי\nאני צריכה מידה מדויקת של שטיח. זה אפשרי?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי! 😊 בשמחה אעזור.\n\nהמידות המדויקות של כל שטיח מופיעות בדף המוצר עצמו.",
    },
    { role: "user", content: "אני צריכה את המידה 2.20 על 2.20" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהבנתי, מחפשים מידה מרובעת של 2.20 על 2.20.\n\nלאיזה חלל בבית מיועד השטיח?",
    },
    { role: "user", content: "חדר שינה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה, חדר שינה.\n\nהאם השטיח אמור להתאים גם לבעלי חיים בבית?",
    },
  ]

  it("binds pets=no to the next intake step instead of LLM stub", () => {
    process.env.SALES_INTAKE_MODE = "scripted"
    const result = runStructuredSalesIntakePreTurn({
      turn: { text: "לא", media: [] },
      history: historyBeforePetsAnswer,
      lastAgent: "faq",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
    assert.doesNotMatch(result.reply, /placeholder/i)
    assert.match(result.reply, /לסיכום|מעביר|דרישות מיוחדות|תמונה/i)
    assert.doesNotMatch(result.reply, /אני צודק/i)
  })

  it("does not hijack cold-start sales questions", () => {
    const result = runStructuredSalesIntakePreTurn({
      turn: {
        text: "היי\nאני צריכה מידה מדויקת של שטיח. זה אפשרי?",
        media: [],
      },
      history: [],
      lastAgent: null,
    })

    assert.equal(result.kind, "skip")
  })

  it("emits sales intake quiz hint while a scripted question is pending", () => {
    process.env.SALES_INTAKE_MODE = "scripted"
    const hints = buildConversationHints({
      body: "לא",
      history: historyBeforePetsAnswer,
      phone: "0544457792",
    })
    assert.match(hints ?? "", /SALES INTAKE QUIZ/i)
    assert.match(hints ?? "", /placeholder/i)
  })
})
