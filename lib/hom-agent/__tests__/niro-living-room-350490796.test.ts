import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractSalesIntake } from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesIntakePreTurn } from "@/lib/hom-agent/pre-turn"

/** 350490796 — NIRO catalog intake: «פרטים נוספים» + «סלון» must continue quiz, not human_sales. */
describe("niro living room sales intake 350490796", () => {
  const historyBeforeLivingRoom: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח נירו קרם-כחול NIRO",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי לאה! בשמחה, נירו קרם-כחול.\n\nכדי שיועץ המכירות יוכל לתת לך את כל הפרטים ולהתאים את השטיח בדיוק לבית שלך, אשאל כמה שאלות קצרות.\n\nלאיזה חלל השטיח מיועד? סלון, חדר שינה, חדר ילדים או משהו אחר?",
    },
  ]

  it("does not false-detect pets from «פרטים נוספים»", () => {
    const intake = extractSalesIntake(historyBeforeLivingRoom, "סלון")
    assert.equal(intake.pets, undefined)
    assert.equal(intake.targetSpace, "סלון")
  })

  it("hints continue intake on סלון — no premature pets or handoff", () => {
    const hints = buildConversationHints({
      body: "סלון",
      history: historyBeforeLivingRoom,
      whatsappPhone: "+972547495083",
    })
    assert.match(hints ?? "", /LIVING ROOM SPACE COMPLETE \(350490796\)/i)
    assert.doesNotMatch(hints ?? "", /PETS ALREADY ANSWERED/i)
    assert.doesNotMatch(hints ?? "", /PRODUCT SPEC DEFERRED/i)
  })

  it("structured pre-turn advances to sofa size with action reply", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    const result = runStructuredSalesIntakePreTurn({
      turn: { text: "סלון", media: [] },
      history: historyBeforeLivingRoom,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /מידת הספה|גודל/i)
    assert.doesNotMatch(result.reply, /מעביר|העברתי/i)
  })
})
