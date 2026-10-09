import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOpenServiceDefectFollowUpThread } from "@/lib/agents/service-intake"
import { isActiveSalesConsultation } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

function history507829534(): HistoryMessage[] {
  return [
    { role: "user", content: "...?" },
    {
      role: "assistant",
      content:
        "היי רונה שיבר ברקת, כאן אביגיל, פונה אליך בעקבות פגם בשטיח. שלח/י לי הודעה חוזרת ונוכל להמשיך את הטיפול מכאן.",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content: "הי.. זה בבדיקה של מנהלת בקרת איכות. אני ממתינה לתשובה",
    },
    {
      role: "assistant",
      content:
        "אשמח להבין איפה השטיח היה ממוקם? איך אתם מנקים אותו, הם יש בעלי חיים בבית?",
    },
    {
      role: "user",
      content: "בחדר שינה של ההורים ניקוי רק עם שואב אבק, דייסון. אין בעלי חיים בבית.",
    },
    {
      role: "assistant",
      content: "כי זה בבדיקה של מנהלת בקרת איכות והיא חולה\nהיא תחזור ביום ראשון.. בנוסף, זו פעם ראדונה דאנחנו נתקלים בתקלה מסוג זה בדטיח",
    },
    { role: "assistant", content: "היא תחזור ונמשיך לטפל" },
    { role: "user", content: "הי, אודה לטיפול בבקשה" },
    { role: "user", content: "?" },
  ]
}

/** Replay 507829534 — defect QC wait; no-response must not restart sales intake. */
describe("defect QC no-response (507829534)", () => {
  it("detects open service defect follow-up thread", () => {
    assert.equal(isOpenServiceDefectFollowUpThread(history507829534()), true)
  })

  it("blocks active sales consultation on open defect case", () => {
    assert.equal(isActiveSalesConsultation(history507829534(), "sales"), false)
  })

  it("emits service defect no-response hint forbidding sales quiz", () => {
    const hints =
      buildConversationHints({
        history: history507829534(),
        body: "לא חזרת אלי..",
      }) ?? ""
    assert.match(hints, /SERVICE DEFECT QC NO-RESPONSE \(507829534\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never.*sales intake/)
    assert.doesNotMatch(hints, /SALES THREAD \(מכירות\)/)
  })
})
