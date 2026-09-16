import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { shouldUseSalesIntakeFastPath } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesIntakePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const ENV_KEY = "SALES_INTAKE_MODE"

afterEach(() => {
  delete process.env[ENV_KEY]
})

/** Replay 532111664 — LLM-led sales quiz must not rewind after לא יודעת on kids ages. */
describe("LLM-led sales quiz (532111664)", () => {
  const historyBeforeUnknown: HistoryMessage[] = [
    { role: "user", content: "היי שלום\nקיבלתי את השטיח אבל אני לא אוהב אותו כל כך\nהוא לא מתאים לסלון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי שלום! 😊 … החלפה / החזרה … איך תרצו להמשיך?",
    },
    { role: "user", content: "אוקיי תודה\nאני רוצה לקנות עוד שטיח\nמה יש לכם?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבשמחה! 😊 באיזה חלל מתכננים לשים את השטיח החדש — סלון, חדר שינה, או מקום אחר?",
    },
    { role: "user", content: "לחדר ילדים שלנו" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה, חדר ילדים 😊 מדובר בילדים קטנים, גדולים, או גם וגם?",
    },
  ]

  it("does not use structured fast path on LLM quiz answers", () => {
    process.env[ENV_KEY] = "llm"
    assert.equal(
      shouldUseSalesIntakeFastPath("לא יודעת", historyBeforeUnknown, "faq"),
      false
    )
  })

  it("structured pre-turn skips so invokeHomAgent keeps the thread", () => {
    process.env[ENV_KEY] = "llm"
    const result = runStructuredSalesIntakePreTurn({
      turn: { text: "לא יודעת", media: [] },
      history: historyBeforeUnknown,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "skip")
  })

  it("emits LLM-led sales quiz hint while intake question is open", () => {
    process.env[ENV_KEY] = "llm"
    const hints = buildConversationHints({
      body: "לא יודעת",
      history: historyBeforeUnknown,
      phone: "+972547495083",
    })
    assert.match(hints ?? "", /LLM-led/i)
    assert.match(hints ?? "", /never re-ask room/i)
  })
})
