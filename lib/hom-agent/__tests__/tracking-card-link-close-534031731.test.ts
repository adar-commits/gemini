import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  shouldConfirmKnownOrderWithCard,
  shouldRefuseKnownOrderLookup,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"
import { clearOrdersLookupCache, rememberOrdersLookup } from "@/lib/agents/order-lookup-cache"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const RECEIPT = `שלום הדר דהן, 👋
תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך:
https://documents.carpetshop.co.il/documents/24a0e474-152a-4628-a611-75225972d716

למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן:
https://tracking.carpetshop.co.il/track?orderID=SO26024665`

const BAD_CONFIRM =
  "*הום בוט :)*\nהיי הדר!\n\nכדי לבדוק מתי ההזמנה צפויה להגיע, מדובר בהזמנה SO26024665 שמופיעה בקישור המעקב?"

const STATUS =
  "*הום בוט :)*\nבדקתי, איזה כיף! המשלוח הועמס לשליח ובדרכו אליך ברגעים אלה. נכון לתאריך 07/10/2026 בשעה 09:03\n\nשמחתי לעזור!"

const websiteOrder: OrderShipmentStatus = {
  orderNumber: "SO26024665",
  branchLabel: "אתר אינטרנט",
  statusCode: "5",
  statusLabel: "בדרך",
  statusDescription: "איזה כיף! המשלוח הועמס לשליח ובדרכו אליך ברגעים אלה.",
  branchCode: "3000",
  totalPrice: 890,
  raw: {
    ORDNAME: "SO26024665",
    REFERENCE: "78111",
    CURDATE: new Date(Date.now() - 5.5 * 24 * 60 * 60 * 1000).toISOString(),
  },
}

/** 534031731 — website order card uses #, tracking-link ask pastes the URL, resolved ETA closes. */
describe("tracking card link close 534031731", () => {
  const opening: HistoryMessage[] = [{ role: "assistant", content: RECEIPT }]

  it("teaches the card, the tracking URL, and action end", () => {
    assert.match(prompt, /534031731/)
    assert.match(prompt, /שמופיעה בקישור המעקב/)
    assert.match(prompt, /action: "end"/)
  })

  it("looks up the tracking order into a # card, not an SO link question", async () => {
    const body = "מתי עתיד להגיע?"
    assert.equal(shouldConfirmKnownOrderWithCard(body, opening), true)
    assert.equal(shouldRefuseKnownOrderLookup(body, opening), false)
    clearOrdersLookupCache()
    rememberOrdersLookup("0500000000", [websiteOrder])
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: body, media: [] },
      history: opening,
      phone: "0500000000",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /שבוצעה/)
    assert.match(result.reply, /באתר אינטרנט/)
    assert.match(result.reply, /78111/)
    assert.doesNotMatch(result.reply, /SO26024665/)
    assert.doesNotMatch(result.reply, /שמופיעה בקישור/)
  })

  it("pastes the tracking URL when asked where it is, instead of shipment status", async () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: RECEIPT },
      { role: "user", content: "מתי עתיד להגיע?" },
      { role: "assistant", content: BAD_CONFIRM },
    ]
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "איפה הקישור מעקב?", media: [] },
      history,
      phone: "0500000000",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /https:\/\/tracking\.carpetshop\.co\.il\/track\?orderID=SO26024665/)
    assert.doesNotMatch(result.reply, /הועמס לשליח/)
    assert.doesNotMatch(result.reply, /שמחתי לעזור/)
  })

  it("hints action end after status when they ask if it arrives today", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: RECEIPT },
      { role: "user", content: "מתי עתיד להגיע?" },
      { role: "assistant", content: BAD_CONFIRM },
      { role: "user", content: "איפה הקישור מעקב?" },
      { role: "assistant", content: STATUS },
    ]
    const hints = buildConversationHints({ body: "היום יגיע?", history }) ?? ""
    assert.match(hints, /RESOLVED ETA CLOSE \(534031731\)/)
    assert.match(hints, /action end/)
  })
})
