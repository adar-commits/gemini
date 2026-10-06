import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isDigitalDocumentRequest,
  isReceiptReferencePresentation,
  shouldDeferDocumentFlowToOrderLookup,
} from "@/lib/agents/digital-document-flow"
import {
  isKnownOrderConfirmPending,
  isOrderDeliveryStatusQuestion,
  isOrderLookupCompletedInThread,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENER =
  "שלום עשיתי הזמנה לפני חודש בערך ועוד לא קיבלתי את ההזמנה מתי צפוי לקבל אותה?"
const BOT_CONFIRM =
  "*הום בוט :)*\nשלום נגם, חודש זה באמת הרבה זמן, אז נבדוק את זה עכשיו. מדובר בהזמנה SO26022029 שמופיעה בקישור המעקב ששלחנו?"
const SERVICE_SUMMARY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: ⁦#76670⁩\n• פנייה לשירות לקוחות\n\nזה מדויק, או שחסר משהו?"
const INVOICE_AUTO =
  "שלום נגם קורדי 👋, תודה על רכישתך בשטיח האדום, להלן קישור לחשבונית מס הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/29f74e1e-d6bb-4cf1-a347-c0e185441183"
const REPEAT_ETA = "מתי אני אקבל את ההזמנה שלי ?!"
const BAD_HANDOFF =
  "*הום בוט :)*\nאת צודקת נגם, חודש זה הרבה מעבר לזמן האספקה הרגיל, ומצטער על העיכוב.\n\nכרגע אין לי כאן צפi מדויק להזמנה ⁦#76670⁩, ולכן אני מעביר אותך עכשיו לנציג שירות שיבדוק אותה ספציפית ויחזור אלייך עם מועד הגעה."

/** Replay 531872131 day-2 — repeat ETA after receipt ref must lookup, not human_service. */
describe("ETA repeat known order 531872131", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENER },
    { role: "assistant", content: BOT_CONFIRM },
    { role: "assistant", content: SERVICE_SUMMARY },
    { role: "user", content: "RC269020017" },
    { role: "user", content: "מס קבלה" },
    { role: "assistant", content: INVOICE_AUTO },
  ]

  it("detects shipping thread with known order and lookup not completed", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(orderIdGivenInThread(history), "SO26022029")
    assert.equal(isOrderLookupCompletedInThread(history), false)
    assert.equal(isKnownOrderConfirmPending(history), false)
    assert.equal(isOrderDeliveryStatusQuestion(REPEAT_ETA), true)
  })

  it("treats RC as receipt ref on shipping thread — defers document flow", () => {
    assert.equal(isReceiptReferencePresentation("RC269020017"), true)
    assert.equal(shouldDeferDocumentFlowToOrderLookup(history.slice(0, 3), "RC269020017"), true)
    assert.equal(isDigitalDocumentRequest("RC269020017"), false)
  })

  it("hints lookup_order_status on repeat ETA — never human_service without lookup", () => {
    const hints = buildConversationHints({ body: REPEAT_ETA, history }) ?? ""
    assert.match(hints, /REPEAT ETA KNOWN ORDER \(531872131\)/)
    assert.match(hints, /SO26022029/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never.*human_service/)
  })

  it("hints receipt ref on shipping thread continues lookup — not document flow", () => {
    const rcHints = buildConversationHints({ body: "RC269020017", history: history.slice(0, 3) }) ?? ""
    assert.match(rcHints, /RECEIPT REF ON SHIPPING \(531872131\)/)
    assert.match(rcHints, /lookup_order_status/)
  })

  it("prompt teaches repeat ETA with known order before handoff", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("531872131") && l.includes("ETA repeat"))
    assert.ok(line, "missing ETA repeat known order rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /human_service/)
    assert.match(line!, /מס קבלה/)
  })

  it("bad handoff skipped lookup despite known order", () => {
    assert.match(BAD_HANDOFF, /מעביר/)
    assert.match(BAD_HANDOFF, /אין לי כאן צפi מדויק/)
    assert.doesNotMatch(BAD_HANDOFF, /בדקתי|סטטוס/)
  })
})
