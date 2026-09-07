import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasDeclarativeHandoffTransfer,
  sanitizeRedundantHandoffConfirm,
} from "@/lib/agents/off-topic"
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
