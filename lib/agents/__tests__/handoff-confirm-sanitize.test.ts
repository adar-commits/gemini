import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasDeclarativeHandoffTransfer,
  isHumanHandoffPending,
  isPendingHandoffCustomerReply,
  sanitizeRedundantHandoffConfirm,
} from "@/lib/agents/off-topic"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"

describe("sanitizeRedundantHandoffConfirm", () => {
  it("detects declarative transfer with אני מעביר אתכם", () => {
    assert.equal(
      hasDeclarativeHandoffTransfer(
        "בנושא קוד הזיכוי — כדי לטפל בזה, אני מעביר אתכם לנציג שירות."
      ),
      true
    )
  })

  it("strips redundant confirm after declarative transfer", () => {
    const reply = `שלום! מבין את התסכול — ממתינים לחזרת שיחה זה לא נעים.

בנושא קוד הזיכוי — כדי לטפל בזה בצורה הכי מהירה, אני מעביר אתכם לנציג שירות שיוכל לבדוק את הסטטוס ולחזור אליכם.

לפני שאני מעביר — האם להעביר את הפנייה לנציג שירות עכשיו?`

    const fixed = sanitizeRedundantHandoffConfirm(reply)
    assert.match(fixed, /אני מעביר אתכם לנציג שירות/)
    assert.doesNotMatch(fixed, /לפני שאני מעביר/)
    assert.doesNotMatch(fixed, /האם להעביר/)
  })

  it("keeps handoff offer-only messages unchanged", () => {
    const reply =
      "אני מבין — תקלה באתר דורשת טיפול של צוות טכני.\nהאם להעביר את הפנייה כעת לנציג שירות שיטפל בזה?"
    assert.equal(sanitizeRedundantHandoffConfirm(reply), reply)
  })

  it("runs through validateHomAgentReply", () => {
    const output = validateHomAgentReply(
      {
        reply: `*הום בוט :)*
בנושא קוד הזיכוי, אני מעביר אתכם לנציג שירות.

לפני שאני מעביר — האם להעביר את הפנייה לנציג שירות עכשיו?`,
        action: "reply",
      },
      "קוד זיכוי"
    )
    assert.doesNotMatch(output.reply, /האם להעביר/)
  })
})

describe("handoff pending after declarative transfer", () => {
  it("treats declarative transfer as pending handoff", () => {
    const history = [
      {
        role: "assistant" as const,
        content:
          "בנושא קוד הזיכוי, אני מעביר אתכם לנציג שירות שיוכל לבדוק את הסטטוס.",
      },
    ]
    assert.equal(isHumanHandoffPending(history), true)
    assert.equal(isPendingHandoffCustomerReply("כן", history), true)
  })

  it("confirms sales handoff after inactivity ping when customer says כן", () => {
    const ping = "*הום בוט :)*\nעדיין כאן?"
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "אני מחפש שטיח לסלון",
      },
      {
        role: "assistant",
        content: `*הום בוט :)*
אז לסיכום: שטיח לסלון, 4×3 מטר.
האם להעביר את הפנייה ליועץ מכירות?`,
      },
      { role: "assistant", content: ping },
    ]
    const result = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
    assert.match(result.reply, /העברתי את השיחה ליועץ מכירות/)
    assert.doesNotMatch(result.reply, /איך אוכל להמשיך/)
  })

  it("pre-turn does not consume yes-confirmation on declarative transfer", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "בנושא קוד הזיכוי, אני מעביר אתכם לנציג שירות שיוכל לבדוק את הסטטוס.",
      },
    ]
    const result = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history,
    })
    assert.equal(result.kind, "skip")
  })
})
