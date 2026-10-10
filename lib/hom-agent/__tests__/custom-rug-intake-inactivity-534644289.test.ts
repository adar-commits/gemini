import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasOpenSalesIntakeQuestion,
  shouldSilentAutoAssignOnQuietWindow,
} from "@/lib/agents/inactivity-policy"
import { isAwaitingSalesIntakeAnswer } from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"

/** 534644289 — custom rug intake; ~60s silence must not silent-handoff mid sofa question. */
describe("custom rug sales intake inactivity 534644289", () => {
  const historyAfterLivingRoom: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי שבת שלום האם ניתן להזמין שטיח בהתאמה אישית? מידות 240 על 260",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* שבת שלום מירי! יועץ מכירות יבדוק אם אפשר לעשות שטיח במידה 240*260 ובאילו דגמים. כדי שיגיע אלייך מוכן, אשאל קודם כמה שאלות קצרות. לאיזה חדר השטיח מיועד?",
      agent: "faq",
    },
    { role: "user", content: "סלון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* אוקיי, קיבלתי. מה מידת הספה או הגודל הכללי של הסלון?",
      agent: "sales",
    },
  ]

  it("awaits sofa answer after סלון", () => {
    assert.equal(isAwaitingSalesIntakeAnswer(historyAfterLivingRoom), true)
  })

  it("blocks silent auto-assign while intake question is open", () => {
    assert.equal(hasOpenSalesIntakeQuestion(historyAfterLivingRoom, "sales"), true)
    assert.equal(
      shouldSilentAutoAssignOnQuietWindow(historyAfterLivingRoom, "sales"),
      false
    )
  })
})
