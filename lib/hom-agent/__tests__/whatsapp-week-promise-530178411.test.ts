import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isOrderLookupCompletedInThread } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BODY = "לי הודעתם בווצאפ שזה יהיה השבוע"
const BAD_HANDOFF =
  "*הום בוט :)* תפארת, מבין שחשוב לך לדעת מתי בדיוק השטיח מגיע. מכאן אני לא רואה מועד אספקה מדויק, לכן אני מעביר את הפנייה לנציג"

/** Replay 530178411 — rep/WhatsApp week promise on known SO must refresh lookup, not human_service. */
describe("whatsapp week delivery promise 530178411", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "מתי אקבל את השטיח???" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מעביר עכשיו את הפנייה לנציג שירות לקוחות שיבדוק את ההזמנה (מס׳ הזמנה SO26020329)",
    },
    {
      role: "assistant",
      content: "היי, המוצר נכנס למלאי ובתהליך ליקוט אספקה במהלך שבוע הבא😊",
    },
    { role: "user", content: "האם יצרו קשר לפני שמביאים לי את השטיח?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי תפארת, כן 🙂 חברת השליחויות מתקשרת ביום האספקה, לפני שהיא מגיעה.",
    },
    {
      role: "assistant",
      content: "*הום בוט :)* בדקתי, סטטוס ההזמנה במערכת: בביצוע.",
    },
  ]

  it("thread already had lookup completed", () => {
    assert.equal(isOrderLookupCompletedInThread(history), true)
  })

  it("hints refresh lookup — not premature handoff without status", () => {
    const hints = buildConversationHints({ body: BODY, history }) ?? ""
    assert.match(hints, /PRIOR WHATSAPP\/REP DELIVERY PROMISE \(530178411\)/)
    assert.match(hints, /SO26020329/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never «מכאן אני לא רואה מועד מדויק»/)
  })

  it("prompt teaches rep/WhatsApp week promise refresh", () => {
    const line = prompt.split("\n").find((l) => l.includes("530178411"))
    assert.ok(line, "missing 530178411 prior promise rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /ווצאפ/)
  })

  it("bad reply skipped lookup and handed off", () => {
    assert.match(BAD_HANDOFF, /לא רואה מועד אספקה מדויק/)
    assert.match(BAD_HANDOFF, /מעביר/)
  })
})
