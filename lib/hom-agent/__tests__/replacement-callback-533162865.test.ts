import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isCallbackUrgencyRequest } from "@/lib/agents/inquiry-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const OPENING =
  "שלום מבקשת לחזור אלי עוד היום עם תאום האספקה אני מרגישה שאני כבר צריכה רודפת אחריכם ללא תגובה אמיתית. כבר מעל שבועיים. במידה ולא תבוצע החלפה לשטיח תקין עד מחר, אני מבקשת ביטול עיסקה והחזר מלא לאשראי."

const BAD_FIRST_REPLY =
  "*הום בוט :)* שלום דיאנה, מבין שאת מחכה כבר יותר משבועיים לשטיח החלופי ומרגישה שאין מענה אמיתי. מצטער על ההמתנה. אני מעביר עכשיו את הפנייה לנציג שירות ומסמן אותה כדחופה, עם בקשה שיחזרו אלייך עוד היום:"

/** Replay 533162865 — urgent callback opener must bind human_service on מעביר עכשיו. */
describe("replacement callback urgency 533162865", () => {
  it("detects callback urgency on long opener with לחזור אלי עוד היום", () => {
    assert.equal(isCallbackUrgencyRequest(OPENING), true)
  })

  it("hints bind human_service when FAQ wrote מעביר עכשיו with action reply", () => {
    const hints = buildConversationHints({ body: OPENING, history: [] }) ?? ""
    assert.match(hints, /CALLBACK URGENCY \(533162865\)/)
    assert.match(hints, /never.*`action: reply` with declarative transfer/i)
    assert.match(hints, /`action: human_service`/i)
    assert.match(BAD_FIRST_REPLY, /מעביר עכשיו/)
  })
})
