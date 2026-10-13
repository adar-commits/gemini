import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isOpenPreorderRestockServiceHandoffThread,
  isPreorderRestockCallbackWaitFollowUp,
} from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const FAQ_OFFER =
  "*הום בוט :)* רונית, השטיח סאן בז 200*290 הוא בהזמנה מוקדמת. במערכת לא מופיע תאריך מדויק לחידוש המלאי. נציג שירות יכול לבדוק מתי צפוי חידוש המלאי. להעביר אותך אליו?"

const FIRST_HANDOFF =
  "*הום בוט :)* מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

const RE_ESCALATE =
  "*הום בוט :)* בוקר טוב רונית. סימנתי את הפנייה בעדיפות לנציג שירות. הוא יבדוק מתי צפוי חידוש המלאי של השטיח סאן בז 200*290 בהזמנה SO26019931. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function history529931531BeforeChase(): HistoryMessage[] {
  return [
    { role: "user", content: "מתי אמור להגיע???" },
    { role: "assistant", content: FAQ_OFFER },
    { role: "user", content: "כן בבקשה" },
    { role: "assistant", content: FIRST_HANDOFF },
    { role: "user", content: "מחכה שתיצרו קשר" },
    { role: "assistant", content: RE_ESCALATE },
  ]
}

/** Replay 529931531 — preorder restock handoff + callback chase must not duplicate human_service. */
describe("preorder restock callback wait 529931531", () => {
  it("detects open preorder restock service handoff thread", () => {
    assert.equal(
      isOpenPreorderRestockServiceHandoffThread(history529931531BeforeChase()),
      true
    )
  })

  it("detects phone/callback wait follow-up", () => {
    assert.equal(
      isPreorderRestockCallbackWaitFollowUp(
        history529931531BeforeChase(),
        "אני מחכה לטלפון שלכם"
      ),
      true
    )
    assert.equal(
      isPreorderRestockCallbackWaitFollowUp(
        history529931531BeforeChase(),
        "מחכה שתיצרו קשר"
      ),
      true
    )
  })

  it("hints reply — not duplicate human_service or re-escalation", () => {
    const hints =
      buildConversationHints({
        history: history529931531BeforeChase(),
        body: "אני מחכה לטלפון שלכם",
      }) ?? ""
    assert.match(hints, /PREORDER RESTOCK CALLBACK WAIT \(529931531\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
    assert.doesNotMatch(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
  })
})
