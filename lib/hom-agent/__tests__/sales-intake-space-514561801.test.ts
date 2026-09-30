import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { shouldUseSalesIntakeFastPath } from "@/lib/agents/sales-intake"
import { runStructuredSalesIntakePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

afterEach(() => {
  delete process.env.SALES_INTAKE_MODE
})

/** Replay 514561801 — room answer must advance sales quiz in LLM mode, not stall overnight. */
describe("sales intake space answer (514561801)", () => {
  const historyBeforeSpaceAnswer: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי אשמח לפרטים נוספים לגבי שטיח קייזר תכלת-צבועני 397*296 KAYZAR",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי גליה! שטיח קייזר בתכלת-צבעוני, במידה 397*296 — אני אשאל כמה שאלות קצרות כדי שיועץ המכירות יוכל לתת לך את כל הפרטים על הדגם. לאיזה חלל השטיח מיועד? (סלון, חדר שינה, חדר ילדים וכו׳)",
    },
  ]

  it("uses structured fast path for סלון after room question in LLM mode", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    assert.equal(
      shouldUseSalesIntakeFastPath("סלון", historyBeforeSpaceAnswer, "faq"),
      true
    )
  })

  it("binds סלון to the next intake question instead of skipping pre-turn", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    const result = runStructuredSalesIntakePreTurn({
      turn: { text: "סלון", media: [] },
      history: historyBeforeSpaceAnswer,
      lastAgent: "faq",
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /סלון/i)
    assert.match(result.reply, /מידת הספה|גודל/i)
    assert.doesNotMatch(result.reply, /placeholder/i)
  })
})
