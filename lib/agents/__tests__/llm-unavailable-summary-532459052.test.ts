import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildLlmFailureReply } from "@/lib/agent-core/fallbacks"
import { resolveLlmUnavailableHandoff } from "@/lib/agents/off-topic"
import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"

const summary = `${CUSTOMER_HEADER}
כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:
• מס׳ הזמנה: #77007
• בקשת החזרה

זה מדויק, או שחסר משהו?`

const baseHistory: HistoryMessage[] = [
  { role: "user", content: "השטיח הגיע אבל אבקש להחזירו היות ובהיר מאוד לעומת התמונה" },
  {
    role: "assistant",
    content: `${CUSTOMER_HEADER}\nמצאתי הזמנה שבוצעה לפני 11 ימים באתר אינטרנט, על סך 553 ש״ח. זו ההזמנה? (מס׳ הזמנה #77007)`,
  },
  { role: "user", content: "כן" },
  { role: "assistant", content: summary },
]

const overload = buildLlmFailureReply({ gatewayBudgetExceeded: true })

describe("532459052 — model down after service summary / repeated failure", () => {
  it("typo confirm of the rep summary hands off to service when the model is down", () => {
    assert.equal(resolveLlmUnavailableHandoff("מדןיק", baseHistory), "human_service")
  })

  it("second failure in a row hands off instead of repeating the overload offer", () => {
    const history: HistoryMessage[] = [
      ...baseHistory,
      { role: "user", content: "מדןיק" },
      { role: "assistant", content: overload },
    ]
    assert.equal(resolveLlmUnavailableHandoff("כם כן", history), "human_service")
  })

  it("decline after the overload offer does not hand off", () => {
    const history: HistoryMessage[] = [{ role: "assistant", content: overload }]
    assert.equal(resolveLlmUnavailableHandoff("לא", history), null)
  })
})
