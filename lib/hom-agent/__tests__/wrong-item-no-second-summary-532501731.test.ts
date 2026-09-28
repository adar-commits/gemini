import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildHumanHandoffConfirmedReply } from "@/lib/agents/human-agent-hours"
import {
  isServiceHandoffOrderLookupReply,
  isServiceOrderIdentificationFlow,
} from "@/lib/agents/order-lookup"
import {
  buildServiceHandoffConfirmReply,
  isServiceHandoffSummaryConfirmedInThread,
} from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

const APPROVED_SUMMARY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• הלקוח הזמין שטיח והגיע אליו פוף\n• קבלה ומדבקה על האריזה שייכות ללקוח\n• צורפו תמונות\n\nזה מדויק, או שחסר משהו?"

function historyThroughOrderCard(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "הביאו לי הזמנה שלא שלי אבל עם קבלה ומדבקה על האריזה שכן שייכת לי",
    },
    { role: "user", content: "הזמנתי שטיח הגיע אלי פוף" },
    { role: "user", content: "[media:image:https://example.com/532501731.jpg]" },
    { role: "assistant", content: APPROVED_SUMMARY },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nנדמה לי שמצאתי את ההזמנה SO260501731 (מס׳ הזמנה #501731) — זו ההזמנה?",
    },
  ]
}

/** Replay 532501731 — summary already approved, order card כן must hand off, not send a second summary. */
describe("wrong item delivered — no second summary (532501731)", () => {
  it("detects the approved service summary before the order card", () => {
    const history = historyThroughOrderCard()
    assert.equal(isServiceHandoffSummaryConfirmedInThread(history), true)
    assert.equal(isServiceOrderIdentificationFlow(history, "כן"), true)
  })

  it("does not treat an unanswered summary as approved", () => {
    const history = historyThroughOrderCard().slice(0, 3)
    assert.equal(isServiceHandoffSummaryConfirmedInThread(history), false)
  })

  it("the handoff reply maps to human_service, a second summary does not", () => {
    assert.equal(
      isServiceHandoffOrderLookupReply(buildHumanHandoffConfirmedReply("human_service")),
      true
    )
    const secondSummary = buildServiceHandoffConfirmReply({}, "כן", historyThroughOrderCard())
    assert.equal(isServiceHandoffOrderLookupReply(secondSummary), false)
    assert.doesNotMatch(buildHumanHandoffConfirmedReply("human_service"), /זה מדויק/)
  })
})
