import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isOpenShippingDelayServiceHandoffThread,
  isShippingDelayHandoffResponseWaitFollowUp,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const PRIOR_HANDOFF =
  "*הום בוט :)* רומי, מצטער על העיכוב בתשובה. כיוון שעבר מועד האספקה, אני מעביר עכשיו לנציג שירות לבדיקה פרטנית של המשלוח: • הזמנה של 2 פופים מלפני כשבוע, על הטלפון 0524843535 • לא התקבלה הודעה על יום ההגעה • בקשה: לבדוק סטטוס ומועד הגעה מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

const COMPLAINT = "עיכוב בתשובה? זה כבר ממש זלזול"

const BAD_REPLY =
  "*הום בוט :)* רומי, מבין שחיכית כמעט שבוע. סימנתי את הפנייה שלך כדחופה אצל נציג שירות. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function history528863688(): HistoryMessage[] {
  return [
    { role: "user", content: "המשלוח היה אמור להגיע כבר לפני ארבעה ימים!!!!" },
    { role: "user", content: "אף אחד לא מעדכן אותי" },
    { role: "user", content: "אין לי מענה מכם כבר כמעט שבוע!!!" },
    { role: "assistant", content: PRIOR_HANDOFF },
  ]
}

/** Replay 528863688 — post-handoff response-wait complaint must not duplicate human_service. */
describe("shipping delay handoff response wait 528863688", () => {
  it("detects open shipping-delay service handoff thread", () => {
    assert.equal(isOpenShippingDelayServiceHandoffThread(history528863688()), true)
  })

  it("detects response-wait follow-up after handoff", () => {
    assert.equal(
      isShippingDelayHandoffResponseWaitFollowUp(history528863688(), COMPLAINT),
      true
    )
  })

  it("hints reply — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: history528863688(),
        body: COMPLAINT,
      }) ?? ""
    assert.match(hints, /SHIPPING DELAY HANDOFF RESPONSE WAIT \(528863688\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
    assert.doesNotMatch(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
  })

  it("prompt teaches shipping delay handoff response wait", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Shipping delay handoff response wait (528863688)"))
    assert.ok(line)
    assert.match(line!, /action: reply/)
    assert.match(line!, /Never.*human_service/i)
  })

  it("bad reply duplicated first-time handoff wording", () => {
    assert.match(BAD_REPLY, /העברתי את השיחה/)
    assert.match(BAD_REPLY, /דחופ/)
  })
})
