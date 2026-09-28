import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { buildDocumentTypeQuestion } from "@/lib/agents/digital-document-flow"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"
import {
  isLikelyTruncatedBotReply,
  repairTruncatedBotReply,
} from "@/lib/hom-agent/truncated-output"

/** 530718020 — "מבקשת חשבונית מקור" → invoice-type menu lost option 2 to the "נקטעה" tail. */
describe("document type menu is not truncated (530718020)", () => {
  const menu = buildDocumentTypeQuestion("invoice")

  it("keeps both invoice options and adds no truncation tail", () => {
    assert.equal(isLikelyTruncatedBotReply(menu), false)
    const repaired = repairTruncatedBotReply(menu)
    assert.match(repaired, /2\. חשבונית מס קבלה/)
    assert.doesNotMatch(repaired, /נקטעה/)
  })

  it("survives validateHomAgentReply unchanged in meaning", () => {
    const out = validateHomAgentReply(
      { reply: menu, action: "reply" } as Parameters<typeof validateHomAgentReply>[0],
      "מבקשת חשבונית מקור",
      "0528792211",
      [
        { role: "user", content: "בוקר טוב" },
        { role: "assistant", content: "*הום בוט :)*\nבוקר טוב! 😊 במה אפשר לעזור?" },
        { role: "user", content: "מבקשת חשבונית מקור" },
      ]
    )
    assert.match(out.reply ?? "", /1\. חשבונית מס\n2\. חשבונית מס קבלה/)
    assert.doesNotMatch(out.reply ?? "", /נקטעה/)
  })

  it("full three-option document menu is complete too", () => {
    assert.doesNotMatch(repairTruncatedBotReply(buildDocumentTypeQuestion(null)), /נקטעה/)
  })

  it("still repairs a genuinely cut-off prose reply", () => {
    const cut =
      "*הום בוט :)*\nבדקתי את ההזמנה שלכם והיא נמצאת כרגע במחסן המרכזי, ההערכה היא שהיא תצא למשלוח בימים הקרוב"
    assert.equal(isLikelyTruncatedBotReply(cut), true)
  })

  it("prompt teaches חשבונית מקור = regular digital copy", () => {
    const prompt = readFileSync(
      path.join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"),
      "utf8"
    )
    assert.match(prompt, /חשבונית מקור.*530718020/)
    assert.match(prompt, /the digital copy \*\*is\*\* the original/)
  })
})
