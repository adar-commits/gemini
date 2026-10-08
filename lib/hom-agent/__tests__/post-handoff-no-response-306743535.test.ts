import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPostHumanHandoff, postHandoffKind } from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const PRIOR_HANDOFF =
  "*הום בוט :)*\nברור, מבין מסכם בשבילכם עבור היועץ:\n• שטיח לסלון, מידה בערך 3.40\n• גוון כהה יותר מהשטיח הנוכחי (שהיה בהיר מדי)\n• לא נדרש התאמה לבעלי חיים\n\nמחבר אתכם עכשיו ליועץ מכירות שיתקדם מכאן."

const BAD_REPLY =
  "*הום בוט :)*\nאוקיי, אז לסיכום אני מחפש עבורכם שטיח לסלון ללא בעלי חיים.\n\nמעביר עכשיו ליועץ מכירות שימשיך מכאן.\n\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

function historyThroughPriorHandoff(): HistoryMessage[] {
  return [
    { role: "user", content: "אוקיי אשמח לדבר בכל מקרה עם יועץ מכירות" },
    { role: "assistant", content: "*הום בוט :)*\nברור, לאיזה חלל?" },
    { role: "user", content: "סלון" },
    { role: "user", content: "שטיח מידה 3.40" },
    { role: "user", content: "לא דיי עם השאלות" },
    { role: "assistant", content: PRIOR_HANDOFF },
    { role: "user", content: "שלום מה שלומכם?" },
    { role: "user", content: "אתם לא חוזרים אלי ואני מאד עמוסה" },
  ]
}

/** Replay 306743535 — post-handoff no-response must re-escalate, not restart sales intake. */
describe("post-handoff no-response re-escalation (306743535)", () => {
  it("detects post-handoff state from prior sales transfer", () => {
    assert.equal(isPostHumanHandoff(null, historyThroughPriorHandoff()), true)
    assert.equal(postHandoffKind(null, historyThroughPriorHandoff()), "human_sales")
  })

  it("bad reply restarts sales intake instead of re-escalating", () => {
    assert.match(BAD_REPLY, /שטיח לסלון ללא בעלי חיים/)
    assert.match(BAD_REPLY, /מעביר עכשיו/)
  })

  it("emits no-response re-escalation hint requiring human_sales", () => {
    const hints =
      buildConversationHints({
        history: historyThroughPriorHandoff(),
        body: "לא הבנתי למה אין מענה?????",
      }) ?? ""
    assert.match(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
    assert.match(hints, /human_sales/)
    assert.match(hints, /Never.*sales intake/)
    assert.doesNotMatch(hints, /PETS ALREADY ANSWERED/)
  })
})
