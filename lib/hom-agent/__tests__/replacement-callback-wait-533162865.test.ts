import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isOpenReplacementDeliveryServiceHandoffThread,
  isReplacementDeliveryCallbackWaitFollowUp,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "שלום מבקשת לחזור אלי עוד היום עם תאום האספקה אני מרגישה שאני כבר צריכה רודפת אחריכם ללא תגובה אמיתית. כבר מעל שבועיים. במידה ולא תבוצע החלפה לשטיח תקין עד מחר, אני מבקשת ביטול עיסקה והחזר מלא לאשראי."

const FIRST_HANDOFF =
  "*הום בוט :)* שלום דיאנה, מבין שאת מחכה כבר יותר משבועיים לשטיח החלופי ומרגישה שאין מענה אמיתי. מצטער על ההמתנה. אני מעביר עכשיו את הפנייה לנציג שירות ומסמן אותה כדחופה, עם בקשה שיחזרו אלייך עוד היום:"

const EXECUTED_HANDOFF =
  "*הום בוט :)* תודה, דיאנה. העברתי את הפנייה לנציג שירות וסימנתי אותה כדחופה, עם בקשה שיחזרו אלייך עוד היום לגבי תיאום האספקה של השטיח החלופי."

const CHASE = "טרם חזרו אלי"

function history533162865FollowUp(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: FIRST_HANDOFF },
    { role: "user", content: "כן" },
    { role: "assistant", content: EXECUTED_HANDOFF },
  ]
}

/** Replay 533162865 — after human_service, «טרם חזרו אלי» must not duplicate human_service. */
describe("replacement delivery callback wait 533162865", () => {
  it("detects open replacement delivery service handoff thread", () => {
    assert.equal(
      isOpenReplacementDeliveryServiceHandoffThread(history533162865FollowUp()),
      true
    )
  })

  it("detects callback wait follow-up", () => {
    assert.equal(
      isReplacementDeliveryCallbackWaitFollowUp(
        history533162865FollowUp(),
        CHASE
      ),
      true
    )
  })

  it("hints reply — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: history533162865FollowUp(),
        body: CHASE,
      }) ?? ""
    assert.match(hints, /REPLACEMENT DELIVERY CALLBACK WAIT \(533162865\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
  })
})
