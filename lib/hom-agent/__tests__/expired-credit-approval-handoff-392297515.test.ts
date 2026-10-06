import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
  isServiceHandoffSummaryText,
} from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { hasDeclarativeHandoffTransfer } from "@/lib/agents/off-topic"

const OPENING =
  "יש לי זיכוי אצלכם, דיברתי שבוע שעבר עם מישהו מהשירות לגבי הזיכוי אם יש אישור לגביו כי עבר חודש ומשהו מהתאריך שהוא פג, ולא חזרו אלי..."

const BAD_SUMMARY =
  "*הום בוט :)*\nמצטער שלא חזרו אליך, זה היה צריך לקרות כבר. אישור על זיכוי שפג תוקפו מקבל נציג שירות, אז אני מעביר את זה אליו כמו שצריך.\n\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• קוד זיכוי שתוקפו פג לפני יותר מחודש\n• בשבוע שעבר פנית לשירות כדי לבקש אישור להשתמש בזיכוי\n• עוד לא חזרו אליך עם תשובה\n• טלפון: 050-9110844\n\nזה מדויק, או שחסר משהו?"

function historyThroughBadSummary(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: BAD_SUMMARY },
  ]
}

/** Replay 392297515 — expired credit approval must not use present-tense מעביר before summary confirm. */
describe("expired credit approval handoff (392297515)", () => {
  it("detects service summary pending after the bad reply", () => {
    assert.equal(isServiceHandoffSummaryText(BAD_SUMMARY), true)
    assert.equal(isServiceHandoffSummaryPending(historyThroughBadSummary()), true)
    assert.equal(isServiceHandoffSummaryConfirmed("נכון מצויין"), true)
  })

  it("flags the bad reply as declarative transfer prose", () => {
    assert.equal(hasDeclarativeHandoffTransfer(BAD_SUMMARY), true)
    assert.match(BAD_SUMMARY, /אני מעביר/)
  })

  it("emits expired credit approval hint on opening turn", () => {
    const history: HistoryMessage[] = []
    const hints = buildConversationHints({ history, body: OPENING }) ?? ""
    assert.match(hints, /392297515/)
    assert.match(hints, /אעביר/)
    assert.match(hints, /Never.*מעביר/)
  })
})

const RE_ESCALATION_BODY =
  "אני מנסה כבר מעל שבוע לתפוס את שירות הלקוחות לגבי זיכוי שיש לי אצלכם ואף אחד לא חוזר אלי"

const BAD_RE_ESCALATION_REPLY =
  "*הום בוט :)*\nצודק, עבר יותר משבוע ואף אחד לא חזר עם תשובה על הזיכוי. מצטער על זה.\n\nהעברתי עכשיו את הפנייה לנציג שירות עם כל הפרטים: זיכוי שתוקפו פג, הבקשה לאישור מהשבוע שעבר, ושעדיין אין תשובה. הנציג יחזור למספר 050-9110844.\n\nאם יש לך את קוד הזיכוי, אפשר לשלוח אותו כאן והוא יתווסף לפנייה."

function historyThroughPriorHandoff(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: BAD_SUMMARY },
    { role: "user", content: "נכון מצויין" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nמעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם.",
    },
    { role: "user", content: "תודה רבה" },
    { role: "assistant", content: "*הום בוט :)*\nבשמחה! הנציג כבר קיבל את הפנייה." },
    { role: "user", content: "היי עדיין לא חזרו אלי" },
  ]
}

/** Replay 392297515 Oct 5 — no-callback re-escalation must bind העברתי to human_service. */
describe("expired credit no-callback re-escalation (392297515)", () => {
  it("bad re-escalation reply uses past-tense transfer wording without human_service", () => {
    assert.match(BAD_RE_ESCALATION_REPLY, /העברתי\s+עכשיו/)
    assert.match(BAD_RE_ESCALATION_REPLY, /נציג שירות/)
  })

  it("emits no-callback re-escalation hint requiring human_service", () => {
    const hints =
      buildConversationHints({
        history: historyThroughPriorHandoff(),
        body: RE_ESCALATION_BODY,
      }) ?? ""
    assert.match(hints, /NO-CALLBACK RE-ESCALATION/)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /service_summary_confirm/)
  })
})
