import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  hasFormalServiceComplaintOpenerInThread,
  isServiceOrderIdentificationFlow,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const OPENING =
  "לכבוד שירות הלקוחות – השטיח האדום קבוצת הום קמעונאות שלום רב, בהמשך למייל ששלחתי אליכם ביום 19.9.2026 בנוגע להזמנה מספר #75554, ולהמשך לשיחת הטלפון (077-972-5055) שקיימתם באותו יום עם בת זוגתי, מיכל, אני מבקש להבהיר כי הטיפול בנושא עדיין לא הושלם. כזכור, במסגרת מבצע 1+1 הוזמנו ושולמו שני פופים, אולם בפועל סופק פוף אחד בלבד."

/** Replay 534387570 — long formal opener must bind service recap after order confirm. */
describe("partial delivery promo 534387570", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENING },
    {
      role: "assistant",
      content: "*הום בוט :)*\nלא מצאתי את ההזמנה #75554 על הטלפון. מה מספר הטלפון?",
      agent: "faq",
    },
    { role: "user", content: "053-8241821" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמצאתי הזמנה… זו ההזמנה? (מס׳ הזמנה #75554)",
      agent: "faq",
    },
  ]

  it("detects formal service opener with order number", () => {
    assert.equal(hasFormalServiceComplaintOpenerInThread(history), true)
  })

  it("keeps service order identification after כנראה שכן", () => {
    assert.equal(isServiceOrderIdentificationFlow(history, "כנראה שכן"), true)
  })

  it("hints service recap from thread, not generic wait week", () => {
    const hints = buildConversationHints({
      history,
      body: "כנראה שכן",
      whatsappPhone: "+972538241821",
    })
    assert.ok(hints)
    assert.match(hints, /534387570|partial 1\+1|פריט חסר/i)
    assert.match(hints, /SERVICE ORDER ID/i)
    assert.doesNotMatch(hints, /ORDER CONFIRM NO ISSUE STATED/)
  })
})
