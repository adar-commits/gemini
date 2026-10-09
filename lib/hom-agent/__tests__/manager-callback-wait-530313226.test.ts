import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasLiveRepPendingCallbackCommitment,
  isPostHumanHandoff,
  postHandoffKind,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BAD_GREETING = "הי.. איך אוכל לעזור?"
const BAD_SKU_ASK = "סידני 02 קרם\\בז 340*240 SYDNEY?"

function historyThroughManagerAssign(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי, מה שלומכם? אני רוצה לבטל הזמנה של שטיח לולאות שעדיין לא סופק לי",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצטער על הבלבול. כרגע אין נציגי שירות זמינים, אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר.",
    },
    { role: "user", content: "כן, תודה אבל מעוניין לבטל" },
    {
      role: "assistant",
      content: "אוקיי שייכתי את השיחה למנהל, נעדכן אותך בהקדם על ביטול",
    },
    { role: "user", content: "תודה" },
  ]
}

/** Replay 530313226 — after manager assign, waiting for callback must re-escalate, not reset. */
describe("manager callback wait re-escalation (530313226)", () => {
  it("detects post-handoff from live rep manager commitment", () => {
    const history = historyThroughManagerAssign()
    assert.equal(hasLiveRepPendingCallbackCommitment(history), true)
    assert.equal(isPostHumanHandoff(null, history), true)
    assert.equal(postHandoffKind(null, history), "human_service")
  })

  it("bad replies reset the thread with generic greeting or SKU quiz", () => {
    assert.match(BAD_GREETING, /איך אוכל לעזור/)
    assert.match(BAD_SKU_ASK, /SYDNEY/)
  })

  it("emits no-response re-escalation hint on waiting-for-contact return", () => {
    const history = historyThroughManagerAssign()
    const hints =
      buildConversationHints({
        history,
        body: "בוקר טוב, מחכה שתצרו איתי קשר",
      }) ?? ""
    assert.match(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
    assert.match(hints, /530313226/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never.*איך אוכל לעזור/)
  })

  it("re-escalates when customer says nobody called back after live rep spoke", () => {
    const history = [
      ...historyThroughManagerAssign(),
      { role: "user", content: "איך לבטל השמנה של שטיח, כבר שייכו את השיחה למנהל אתמול" },
      { role: "assistant", content: BAD_SKU_ASK },
    ]
    const hints =
      buildConversationHints({
        history,
        body: "לא חזרתם אלי",
      }) ?? ""
    assert.match(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
    assert.match(hints, /cancel undelivered|ביטול/i)
  })
})
