import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  coerceKbSelfServiceFaqAction,
  isKbSelfServiceFaqThisTurn,
} from "@/lib/agents/kb-self-service-faq"
import type { HistoryMessage } from "@/lib/agents/types"

const PORTAL = "https://returns.carpetshop.co.il/?phone=0509571292"

/** 532732671 — portal link from yesterday was in history, so the handoff was downgraded to reply. */
const priorThread: HistoryMessage[] = [
  { role: "user", content: "נכון" },
  {
    role: "assistant",
    content: `תודה תמר. כדי לפתוח את בקשת הביטול יש להיכנס לפורטל: ${PORTAL} אם ההזמנה כבר נשלחה, אפשר להחזיר אותה תוך 14 ימים מקבלתה.`,
  },
]

const cancelRequest = "שלום אני רוצה לבטל את ההזמנה בבקשה לפני שהיא נשלחת אליי"
const firstReply = `היי תמר, הבנתי. חשוב לעצור את ההזמנה #77137 לפני שהיא יוצאת. כדי לפתוח את בקשת הביטול, יש להיכנס לפורטל: ${PORTAL} במקביל אני מעביר אותך עכשיו לנציג שירות, כדי שיעצור את המשלוח.`
const portalFailure = "אי אפשר לבטל בפורטל, זה לא מראה את ההזמנה שם"

describe("pre-delivery cancel keeps human_service (532732671)", () => {
  it("cancel request with portal link in history keeps human_service", () => {
    const out = coerceKbSelfServiceFaqAction(
      { action: "human_service", reply: firstReply },
      cancelRequest,
      priorThread
    )
    assert.equal(out.action, "human_service")
  })

  it("follow-up 'portal does not show the order' keeps human_service", () => {
    const history: HistoryMessage[] = [
      ...priorThread,
      { role: "user", content: cancelRequest },
      { role: "assistant", content: firstReply },
    ]
    const out = coerceKbSelfServiceFaqAction(
      { action: "human_service", reply: "הבנתי תמר, אני מעביר את הבקשה לביטול ההזמנה לנציג שירות." },
      portalFailure,
      history
    )
    assert.equal(out.action, "human_service")
  })

  it("cancellation policy question stays a self-service FAQ", () => {
    assert.equal(isKbSelfServiceFaqThisTurn("מה מדיניות ביטול עסקה?", []), true)
    const out = coerceKbSelfServiceFaqAction(
      { action: "human_service", reply: "x" },
      "מה מדיניות ביטול עסקה?",
      []
    )
    assert.equal(out.action, "reply")
  })
})
