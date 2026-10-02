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

const BAD_SUMMARY =
  "*הום בוט :)* קיבלתי את החשבונית, תודה רינת. לא הצלחתי להציג לך כאן את צפי האספקה, אז אני מעביר את זה לנציג שירות שיבדוק את שתי ההזמנות. זה מה שהוא יקבל: • הזמנה ראשונה: #77317 • הזמנה שנייה: IN264020380 • מה ביקשת: לדעת מתי מגיעים שני השטיחים זה מדויק, או שחסר משהו?"

function historyThroughBadSummary(): HistoryMessage[] {
  return [
    { role: "user", content: "אשמח לדעת מה הצפי אספקה של שני השטיחים שהזמנתי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כדי לבדוק את צפי האספקה, מדובר בשתי ההזמנות SO26022894 ו-SO26023040?",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קודם אמצא את ההזמנה — האם היא רשומה על המספר ממנו אני מתכתב? (050-8482686)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה לפני 10 ימים, 375 ש״ח. זו ההזמנה? (מס׳ #77317)",
    },
    {
      role: "user",
      content:
        "כן זאת הזמנה אחת, ויש אחת נוספת\nזאת ההזמנה השניה\n[media:image:invoice.jpg]",
    },
    { role: "assistant", content: BAD_SUMMARY },
  ]
}

/** Replay 532828502 — multi-order delivery ETA handoff summary must not use present-tense מעביר with reply. */
describe("multi-order delivery handoff (532828502)", () => {
  it("detects alternate service summary wording", () => {
    assert.equal(isServiceHandoffSummaryText(BAD_SUMMARY), true)
    assert.equal(isServiceHandoffSummaryPending(historyThroughBadSummary()), true)
    assert.equal(isServiceHandoffSummaryConfirmed("מדויק"), true)
  })

  it("flags the bad reply as declarative transfer prose", () => {
    assert.equal(hasDeclarativeHandoffTransfer(BAD_SUMMARY), true)
    assert.match(BAD_SUMMARY, /אני מעביר/)
    assert.doesNotMatch(BAD_SUMMARY, /אעביר לו:/)
  })

  it("emits multi-order delivery ETA hint before summary", () => {
    const history = historyThroughBadSummary().slice(0, -1)
    const body = history.at(-1)?.content ?? ""
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /532828502/)
    assert.match(hints, /אעביר/)
    assert.match(hints, /Never.*מעביר/)
  })
})
