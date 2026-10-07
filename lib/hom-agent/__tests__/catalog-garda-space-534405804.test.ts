import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { shouldUseSalesIntakeFastPath } from "@/lib/agents/sales-intake"
import {
  hasStructuredPendingStateBinding,
  shouldDeferStructuredPreTurnToLlm,
} from "@/lib/hom-agent/opening-turn-llm"
import { runStructuredSalesIntakePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

afterEach(() => {
  delete process.env.SALES_INTAKE_MODE
})

/** 534405804 — GARDA catalog intake: חדר שינה after room question must continue quiz, not human_sales. */
describe("catalog garda space answer 534405804", () => {
  const historyBeforeBedroomAnswer: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח גארדה 03 קרם GARDA",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי מור! שמח שגארדה 03 קרם תפס לך את העין.\n\nכדי שיועץ המכירות יוכל לתת את כל הפרטים ולהתאים אותו בדיוק לבית, כמה שאלות קצרות לפני כן.\n\nלאיזה חלל מיועד השטיח? סלון, חדר שינה, חדר ילדים או מקום אחר?",
    },
  ]

  const bedroomTurn = { text: "חדר שינה", media: [] as [] }

  it("binds open sales intake question to structured pre-turn", () => {
    assert.equal(
      hasStructuredPendingStateBinding(
        historyBeforeBedroomAnswer,
        bedroomTurn,
        bedroomTurn.text
      ),
      true
    )
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(historyBeforeBedroomAnswer, bedroomTurn),
      false
    )
  })

  it("advances intake on חדר שינה instead of handoff", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    assert.equal(
      shouldUseSalesIntakeFastPath(
        bedroomTurn.text,
        historyBeforeBedroomAnswer,
        "faq"
      ),
      true
    )

    const result = runStructuredSalesIntakePreTurn({
      turn: bedroomTurn,
      history: historyBeforeBedroomAnswer,
      lastAgent: "faq",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /החדר משמש ביום/i)
    assert.doesNotMatch(result.reply, /מעביר|העברתי/i)
  })
})
