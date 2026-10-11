import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const VIDEO_BODY =
  "[סרטון][media:video:https://storage.googleapis.com/media.landbot.io/256062/customers/528665655/FXEAO44U27LGY5PAAVOA9GXJKQ1UN9RV.mp4]"

/** Replay 528910185 — video after shipping callback must hint human_service, not sales. */
describe("shipping callback video (528910185)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "ומתי מגיע השטיח?" },
    {
      role: "assistant",
      content:
        "המשלוח כבר אצל חברת השליחויות לפני הפצה. ביקשתי מהם לזרז אספקה. שליח ייצור עימך קשר בהקדם.",
    },
    { role: "user", content: "שבוע טוב,מבקשת ליצור איתי קשר🙏🏽" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* שבוע טוב עינת רשמתי שביקשת שיחזרו אלייך לגבי המשלוח של שטיח גארדה אפור (הזמנה 427234), למספר 050-6714946.",
    },
    { role: "user", content: "שלום, מבקשת לחזור אליי בהקדם" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצטער, אני לא יכול לצפות בסרטונים. אפשר לכתוב בקצרה מה רצית, או לשלוח תמונה?",
    },
  ]

  it("binds SERVICE SHIPPING VIDEO hint — never generic sales video path", () => {
    const hints = buildConversationHints({ history, body: VIDEO_BODY }) ?? ""
    assert.match(hints, /SERVICE SHIPPING VIDEO \(528910185\)/)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /Never `\*\*human_sales\*\*`/)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
  })
})
