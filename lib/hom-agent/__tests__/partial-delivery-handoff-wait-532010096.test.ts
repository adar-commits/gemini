import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isPartialDeliveryServiceHandoffAwaitingCallback,
  isShippingDelayHandoffResponseWaitFollowUp,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OOO_HANDOFF =
  "*הום בוט :)* מבין אביבה, עבר הרבה זמן והשטיח עדיין לא אצלך. לגבי הסימון \"נמסר\": המערכת מסמנת משלוח כנמסר לפי הדיווח של חברת השליחויות. כאן בפועל הגיעו רק המדבקות, ולכן צריך לבדוק את זה מול השליח. אלה הפרטים לטיפול: • מס׳ הזמנה: #76702 • הגיעו רק מדבקות הסיליקון • השטיח מדליון קרם 340*240 לא הגיע (צפי היה 09/10/2026) • במערכת מופיע נמסר בשליח ב-11/10 בשעה 08:17 • התשלום כבר ירד • זמינה לשיחה החל מ-14:30 כרגע אין נציגי שירות זמינים (שעות הפעילות א'-ה' 09:00-16:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות."

const FAQ_PING =
  "*הום בוט :)* שלום אביבה, הפנייה שלך על שטיח מדליון קרם 340*240 מהזמנה #76702 שלא הגיע מחכה לצוות השירות. רשמנו גם שאת זמינה לשיחה החל מ-14:30. הצוות עובד בימים א'-ה' בין 09:00 ל-16:00. יש משהו חדש שתרצי להוסיף לפנייה?"

const CHASE =
  "כן שלא חזרו אליי עדיין.\nוזה פשוט ביזיון וזילזול בלקוח.\nבמידה ולא יחזרו אליי עד מחר בבוקר, אני מעבירה פנייה לשירות לצרכן וכל גורם רלוונטי המייצג את הצרכן בישראל.\n שיתקשרו בבוקר אהיה זמינה!"

const BAD_CHASE_REPLY =
  "*הום בוט :)* מצטער שעדיין לא חזרו אלייך, אביבה. מבין שזה מתסכל, במיוחד כשהשטיח לא הגיע והתשלום כבר ירד. כרגע אין נציגי שירות זמינים (שעות הפעילות א'-ה' 09:00-16:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות."

function historyBeforeChase(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "לא קיבלתי את השטיח שהזמנתי מס הזמנה #76702",
    },
    { role: "user", content: "עברו למעלה מ30 יום הצפי היה 9.10.26" },
    { role: "assistant", content: OOO_HANDOFF },
    { role: "user", content: "מבקשת שתחזרו אליי בדחיפות בעניין." },
    { role: "user", content: "בוקר טוב, אני ממתינה להתייחסות בקשר למשלוח שלא הגיע אליי." },
    { role: "user", content: "שלום" },
    { role: "assistant", content: FAQ_PING },
  ]
}

/** Replay 532010096 — partial delivery OOO handoff + callback chase must not duplicate human_service. */
describe("partial delivery handoff wait 532010096", () => {
  it("detects partial delivery service handoff awaiting callback", () => {
    assert.equal(isPartialDeliveryServiceHandoffAwaitingCallback(historyBeforeChase()), true)
  })

  it("detects no-callback chase after partial delivery handoff", () => {
    assert.equal(
      isShippingDelayHandoffResponseWaitFollowUp(historyBeforeChase(), CHASE),
      true
    )
  })

  it("hints callback resume on שלום — not «יש משהו חדש»", () => {
    const hints =
      buildConversationHints({
        history: historyBeforeChase().slice(0, -2),
        body: "שלום",
      }) ?? ""
    assert.match(hints, /PARTIAL DELIVERY CALLBACK RESUME \(532010096\)/)
    assert.match(hints, /Never.*משהו חדש/i)
  })

  it("hints reply on callback chase — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: historyBeforeChase(),
        body: CHASE,
      }) ?? ""
    assert.match(hints, /532010096/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
  })

  it("prompt teaches partial delivery handoff response wait", () => {
    assert.match(prompt, /532010096/)
    assert.match(prompt, /partial delivery/i)
  })

  it("bad production chase reply duplicated OOO handoff", () => {
    assert.match(BAD_CHASE_REPLY, /אין נציגי שירות/)
    assert.match(BAD_CHASE_REPLY, /קיבלנו את הפנייה/)
  })
})
