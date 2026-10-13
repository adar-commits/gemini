import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBackInStockSalesHandoffThread } from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const PHOTO_HANDOFF =
  "*הום בוט :)*\nהיי טל! קיבלתי את התמונה אני לא יכול לזהות דגם מתוך תמונה, אז אני מעביר אותה ליועץ מכירות. הוא יזהה את הדגם ויחזור אליכם עם השם, יחד עם האפשרויות הדומות לעלמה 02 במידה XXL ‏(240*340).\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

const BAD_REPLY =
  "*הום בוט :)*\nסליחה על ההמתנה, טל סימנתי ליועץ המכירות שאתם מחכים לתשובה.\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

function history534144934(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי, אשמח לקבל עדכון כשהמידה XXL - 240*340 של שטיח עלמה 02 חום ALMA חוזרת למלאי",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי טל! קיבלנו את הבקשה לעדכון על שטיח עלמה 02 חום במידה XXL ‏(240*340), וגם את הבקשה על רטרו קרם-ירוק באותה מידה. בינתיים, אולי אוכל לעניין אתכם בשטיח דומה?",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבשמחה! רק לוודא: שטיח עלמה 02 חום במידה XXL ‏(240*340) הוא הרפרנס הנכון?",
    },
    { role: "user", content: "עלמה 02" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה!\n• בקשה לעדכון כשעלמה 02 חום ALMA במידה XXL ‏(240*340) חוזר למלאי\n• מחפשים שטיח דומה לעלמה 02 באותה מידה\nמעביר עכשיו ליועץ מכירות\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם.",
    },
    {
      role: "user",
      content: "היי מה שם הדגם שבתמונה? [media:image]",
    },
    { role: "assistant", content: PHOTO_HANDOFF },
  ]
}

/** Replay 534144934 — wait ping after back-in-stock sales handoff must not duplicate human_sales. */
describe("back-in-stock sales wait ping (534144934)", () => {
  it("detects back-in-stock sales handoff in thread", () => {
    const history = history534144934()
    assert.equal(isBackInStockSalesHandoffThread(history), true)
  })

  it("bad reply duplicates first-time sales transfer", () => {
    assert.match(BAD_REPLY, /העברתי את השיחה ליועץ מכירות/)
  })

  it("emits back-in-stock sales wait ping forbidding duplicate human_sales on ?", () => {
    const hints =
      buildConversationHints({
        history: history534144934(),
        body: "?",
      }) ?? ""
    assert.match(hints, /BACK IN STOCK SALES WAIT PING \(534144934\)/)
    assert.match(hints, /action: reply/)
    assert.match(hints, /NEVER duplicate.*human_sales/i)
  })
})
