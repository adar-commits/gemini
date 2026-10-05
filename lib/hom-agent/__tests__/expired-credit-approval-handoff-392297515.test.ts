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
