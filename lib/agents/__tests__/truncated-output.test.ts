import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isLikelyTruncatedBotReply,
  repairTruncatedBotReply,
} from "@/lib/hom-agent/truncated-output"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"

const SIGALIT_TRUNCATED = `*הום בוט :)*
היי סיגלית

לגבי תיאום מועד המשלוח — לא ניתן לקבוע מראש תאריך או שעה מדויקים, חברת השליחויות פונה בטלפון ביום האספקה עצמו לתיאום ההגעה.

כדי לוודא שהבקשה שלכם (מיום רביעי ואילך) תילקח בח`

describe("truncated bot output (301810743 Sigalit)", () => {
  it("detects mid-word cut reply", () => {
    assert.equal(isLikelyTruncatedBotReply(SIGALIT_TRUNCATED), true)
  })

  it("repairs by dropping incomplete tail and completing the thought", () => {
    const repaired = repairTruncatedBotReply(SIGALIT_TRUNCATED)
    assert.doesNotMatch(repaired, /תילקח בח/)
    assert.match(repaired, /תיאום ההגעה\./)
    assert.match(repaired, /3076|מספר הזמנה/)
    assert.match(repaired, /[.?]\s*$/)
  })

  it("validateHomAgentReply applies generic truncation repair", () => {
    const result = validateHomAgentReply(
      { reply: SIGALIT_TRUNCATED, action: "reply" },
      "אבקש להגיע מיום רביעי והלאה"
    )
    assert.doesNotMatch(result.reply, /תילקח בח/)
    assert.match(result.reply, /3076|מספר הזמנה/)
  })
})

describe("complete replies are not flagged", () => {
  it("accepts normal ending punctuation", () => {
    assert.equal(
      isLikelyTruncatedBotReply("*הום בוט :)*\nההזמנה בדרך. אפשר לעזור במשהו נוסף?"),
      false
    )
  })
})
