import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isServiceHandoffSummaryText } from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

const SERVICE_SUMMARY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: SO26024018\n• הוזמנו 2 שטיחי חול פסים בצבע באז\n• לפי הלקוחה הגיע אחד בבאז ואחד באפור (האריזות לא נפתחו)\n• מבוקש לתאם החלפה של האפור לבאז\n\nזה מדויק, או שחסר משהו?"

const PHOTO_OFFER =
  "*הום בוט :)*\nקיבלתי את התמונה. על המדבקה כתוב פוף חול פסים מרובע 40×40×30 בצבע אפור.\nאפשר לפתוח ולבדוק.\nאחרי שתבדקי, כתבי לי איזה צבע יש בפנים, ואני אעדכן את הנציג.\nאו שאפשר להעביר לו את הפנייה כבר עכשיו, עם התמונה של המדבקה.\nלהעביר עכשיו?"

function historyThroughUrgentQuestion(): HistoryMessage[] {
  return [
    { role: "user", content: "היי" },
    { role: "user", content: "יש סיכוי שטעיתם לי בהזמנה?" },
    { role: "user", content: "הזמנתי 2 חול פסים בצבע באז" },
    { role: "user", content: "הבאתם לי אחד אפור אחד באז" },
    { role: "user", content: "לא פתחתי עדיין" },
    { role: "assistant", content: SERVICE_SUMMARY },
    {
      role: "user",
      content:
        "לא לפתוח ולבדוק אולי זה טעות במדבקה?\n[media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533370170/OJ1L3RFD0HSPTGXJVUQDNJMRJ8KC68V1.jpg]",
    },
    { role: "assistant", content: PHOTO_OFFER },
    {
      role: "user",
      content:
        "יש מצב זה יהיה היום? הנהג עזב את הבית ממש לפני עשרים דק\nמה שתגיד אתה\nלפתוח או לא?",
    },
  ]
}

/** Replay 533620279 — wrong-item photo + urgency must hand off, not defer transfer after opening. */
describe("wrong item color — photo handoff (533620279)", () => {
  it("detects service summary and label photo in thread", () => {
    const history = historyThroughUrgentQuestion()
    assert.equal(
      history.some(
        (message) =>
          message.role === "assistant" && isServiceHandoffSummaryText(message.content)
      ),
      true
    )
    assert.match(
      history.map((message) => message.content).join("\n"),
      /\[media:image:/
    )
  })

  it("emits the wrong-item photo handoff hint on the urgent follow-up", () => {
    const history = historyThroughUrgentQuestion()
    const body = history.at(-1)?.content ?? ""
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /533620279/)
    assert.match(hints, /human_service NOW/)
    assert.match(hints, /Never defer/)
  })

  it("the bad reply deferred handoff until after opening", () => {
    const badReply =
      "לדעתי כדאי לפתוח. אחרי שתפתחי, כתבי לי איזה צבע יש בפנים, ואני מעביר את הפנייה לנציג מיד."
    assert.match(badReply, /אחרי שתפתחי.*מעביר/)
  })
})
