import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hasPastTenseHandoffExecutedInText } from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const FOLLOWUP = "יש חדש לגבי הזיכוי?"
const CREDIT_ETA_ASK = "היי\nמתי אקבל את הזיכוי לאשראi?"

const UNEXECUTED_TRANSFER_PROSE =
  "*הום בוט :)*\nהיי אורית, הזיכוי חוזר לכרטיס האשראi. צוות השירות זמין עכשיו, אז העברתי את השיחה לנציג שירות לבירור דחוף:\n• בירור סטטוס זיכוי לכרטיס האשראi\n• הלקוחה מחכה כבר כמה ימים\n• טלפון: 050-7309009"

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

  it("does not treat rep-bullet transfer prose as executed CRM assign", () => {
    assert.equal(hasPastTenseHandoffExecutedInText(UNEXECUTED_TRANSFER_PROSE), false)
  })

  it("hints refund status + action binding on credit ETA ask", () => {
    const history = oritRefundThread()
    const hints = buildConversationHints({ history, body: CREDIT_ETA_ASK }) ?? ""
    assert.match(hints, /REFUND STATUS FOLLOW-UP \(295276261\)/)
    assert.match(hints, /human_service/)
  })

  it("binds human_service on thanks after unexecuted transfer prose", () => {
    const threadHistory: HistoryMessage[] = [
      ...oritRefundThread().slice(0, -1),
      { role: "assistant", content: UNEXECUTED_TRANSFER_PROSE },
    ]
    const result = runPreTurnGuards({
      turn: { text: "תודה רבה", media: [] },
      history: [{ role: "assistant", content: UNEXECUTED_TRANSFER_PROSE }],
      threadHistory,
      customerName: "אורית",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.doesNotMatch(result.reply, /הנציג כבר קיבל/)
  })
})
