import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { postHandoffKind } from "@/lib/agents/post-handoff"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const SALES_HANDOFF =
  "*הום בוט :)* היי! מכאן אני לא יכול לרשום התראה על חזרה למלאי. יועץ מכירות יבדוק מתי אמור לחזור למלאי שטיח סופט קרם-בז' במידה XL 200*290 ויעדכן אתכם. מעביר אתכם אליו עכשיו."

const OOO_AUTO_REPLY =
  "היי, תודה שפנית אליי💛 שעות פעילות הסטודיו: ימים א-ה בין 09:00-15:00 השאירו הודעה ואחזור אליכם בהקדם. סיון שהם Argaman home styling 🏡"

// 441678247: sales back-in-stock handoff → voice-closure template (service wording) → customer OOO auto-reply.
describe("sales handoff survives voice-closure template (441678247)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי, אשמח לקבל עדכון כשהמידה XL - 200*290 של שטיח סופט קרם-בז' SOFT חוזרת למלאי" },
    { role: "assistant", content: SALES_HANDOFF },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
    { role: "user", content: OOO_AUTO_REPLY },
  ]

  it("postHandoffKind stays human_sales — not misread from the service template", () => {
    assert.equal(postHandoffKind(null, history), "human_sales")
  })

  it("voice-closure hint keeps human_sales for a prior sales handoff", () => {
    const hints =
      buildConversationHints({
        history: history.slice(0, -1),
        body: OOO_AUTO_REPLY,
      }) ?? ""
    assert.match(hints, /human_sales/)
    assert.match(hints, /441678247/)
    assert.doesNotMatch(hints, /set action human_service in the same JSON\.$/)
  })
})
