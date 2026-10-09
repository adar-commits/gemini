import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const FOLLOWUP = "יש חדש לגבי הזיכוי?"

function oritRefundThread(): HistoryMessage[] {
  return [
    { role: "user", content: "השטיח לא כמו בתמונה אני רוצה להחזיר אותו" },
    { role: "user", content: "אני אשלם לשליח" },
    { role: "assistant", content: "דואגת לך לאיסוף, שליח יוצר קשר לפני" },
    {
      role: "user",
      content: "גמר חתימה טובה מתי יבוצע הזיכוי? השליח אסף בשבוע שעבר את השטיח",
    },
    {
      role: "assistant",
      content:
        "היי אורית קרונזון, כאן אביגיל, פונה אליך בעקבות סטטוס זיכוי. שלח/י לי הודעה חוזרת ונוכל להמשיך את הטיפול מכאן.",
    },
    { role: "user", content: "אז מה קורה עם הזיכוי? לא יפה ככה" },
    {
      role: "assistant",
      content: "יש מישהי שאחראית לרבל את ההחזרות אצלינו. אני בודקת מולה ודואגת לזיכוי דחוף",
    },
    { role: "user", content: FOLLOWUP },
  ]
}

describe("refund status follow-up 295276261", () => {
  it("emits REFUND STATUS FOLLOW-UP hint with live rep context", () => {
    const history = oritRefundThread()
    const hints = buildConversationHints({ history, body: FOLLOWUP })
    assert.ok(hints)
    assert.match(hints!, /REFUND STATUS FOLLOW-UP \(295276261\)/)
    assert.match(hints!, /human_service/)
    assert.match(hints!, /live rep was handling/)
  })
})
