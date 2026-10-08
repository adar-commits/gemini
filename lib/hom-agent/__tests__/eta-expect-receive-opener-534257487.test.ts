import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { extractOrderReference } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isVoiceClosureTemplateMessage } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

const VOICE_WAKE =
  "היי 😀👋, מחלקת שירות הלקוחות שלנו פועלת ב-WhatsApp / אימייל בלבד. פונה אליך בהמשך לשיחתך הטלפונית, איך אוכל לעזור?"
const body =
  "צהרים טובים\nצפי לקבל הזמנה s026024964 מודיעין יער ירושלים 11/5 מודיעין מכבים רעות"
const badReply =
  "*הום בוט :)* צהריים טובים פיני, את התקדמות ההזמנה אפשר לראות בקישור המעקב: https://tracking.carpetshop.co.il/track?orderID=SO26024964 חברת השליחויות יוצרת קשר ביום האספקה עצמו, לקראת ההגעה לכתובת. כדי שתקבל צפי מדויק, אני מעביר את הפנייה לנציג שירות שיבדוק את ההזמנה ויחזור אליך כאן"
const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** 534257487 — «צפי לקבל הזמנה» + order id after voice wake must lookup, not human_service. */
describe("ETA expect receive opener 534257487", () => {
  const history: HistoryMessage[] = [{ role: "assistant", content: VOICE_WAKE }]

  it("extracts order id from merged opener after voice wake", () => {
    assert.equal(extractOrderReference(body, history), "SO26024964")
    assert.equal(isVoiceClosureTemplateMessage({ body: VOICE_WAKE }), true)
  })

  it("hints lookup_order_status — not human_service without lookup", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /VOICE CALLBACK TEMPLATE.*534257487/)
    assert.match(hints, /ETA OPENER \+ ORDER ID.*534257487/)
    assert.match(hints, /SO26024964/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never.*human_service/i)
  })

  it("prompt teaches צפי לקבל + order id without premature handoff", () => {
    const line = prompt.split("\n").find((l) => l.includes("534257487") && l.includes("צפי לקבל"))
    assert.ok(line, "missing ETA opener rule for 534257487")
    assert.match(line!, /lookup_order_status/)
  })

  it("bad reply handed off without lookup", () => {
    assert.match(badReply, /מעביר.*נציג/)
    assert.doesNotMatch(badReply, /בדקתי/)
  })
})
