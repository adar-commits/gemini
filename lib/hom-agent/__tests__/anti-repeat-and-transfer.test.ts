import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  inferHumanHandoffAction,
  isHumanHandoffAffirmation,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"
import type { HistoryMessage } from "@/lib/agents/types"

const CAMPAIGN_OFFER = `*הום בוט :)*
בדקתי בשבילכם 😊
לא מצאתי במערכת מבצע שמתאים ל"טרייד אין".
אם תרצו — אפשר להעביר ליועץ מכירות 🙏`

describe("transfer request after a handoff offer (trade-in regression)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "אני רוצה לשמוע לגבי הטרייד אין" },
    { role: "assistant", content: CAMPAIGN_OFFER },
  ]

  it("recognizes 'אפשר להעביר ליועץ מכירות' as a pending handoff offer", () => {
    assert.equal(isHumanHandoffPending(history), true)
  })

  it("treats תעביר variants as handoff affirmations", () => {
    assert.equal(isHumanHandoffAffirmation("תעביר"), true)
    assert.equal(isHumanHandoffAffirmation("תעביר ליועץ מכירות"), true)
    assert.equal(isHumanHandoffAffirmation("תעביר אותי לנציג"), true)
    assert.equal(isHumanHandoffAffirmation("תודה רבה"), false)
  })

  it("routes the confirmed handoff to sales when the offer was ליועץ מכירות", () => {
    assert.equal(inferHumanHandoffAction(history, null), "human_sales")
  })
})

describe("anti-repeat guard", () => {
  it("replaces an exact repeat with an apology + human offer", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "אני רוצה לשמוע לגבי הטרייד אין" },
      { role: "assistant", content: CAMPAIGN_OFFER },
    ]
    const result = validateHomAgentReply(
      { reply: CAMPAIGN_OFFER, action: "reply" },
      "תעביר",
      "+972506991754",
      history
    )
    assert.notEqual(result.reply.trim(), CAMPAIGN_OFFER.trim())
    assert.match(result.reply, /סליחה/)
    assert.match(result.reply, /להעביר/)
  })

  it("leaves distinct replies untouched", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: "*הום בוט :)*\nתשובה קודמת אחרת" },
    ]
    const result = validateHomAgentReply(
      { reply: "*הום בוט :)*\nתשובה חדשה לגמרי", action: "reply" },
      "שאלה",
      undefined,
      history
    )
    assert.match(result.reply, /תשובה חדשה לגמרי/)
  })
})
