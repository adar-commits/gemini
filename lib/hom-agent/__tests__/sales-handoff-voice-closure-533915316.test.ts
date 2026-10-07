import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPureHandoffAffirmation } from "@/lib/agents/compound-reply"
import {
  isHumanHandoffOfferPending,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import {
  shouldRecordVoiceClosureTemplate,
  shouldSkipVoiceClosureCustomerReplyWake,
} from "@/lib/landbot/handle-inbound"
import { PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

const SALES_STOCK_HANDOFF =
  "*הום בוט :)* בדקתי זמינות לדגם 57401140-160220 בסניפים. לפי הנתונים במערכת לא מופיע מלאי כרגע — כדאי לפנות לסניף לוודא. האם להעביר ליועץ מכירות שיבדוק ויאמת?"

/** 533915316 — sales handoff confirm כן must not re-wake voice_closure after bot already replied. */
describe("sales handoff confirm skips voice closure wake 533915316", () => {
  const historyBeforeKen: HistoryMessage[] = [
    { role: "user", content: "היי" },
    { role: "assistant", content: PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY },
    { role: "assistant", content: SALES_STOCK_HANDOFF },
  ]

  it("still detects sales handoff offer pending after voice template + stock reply", () => {
    assert.equal(isHumanHandoffOfferPending(historyBeforeKen), true)
    assert.equal(isHumanHandoffPending(historyBeforeKen), true)
    assert.equal(isPureHandoffAffirmation("כן"), true)
  })

  it("skips voice-closure wake on כן once the bot replied after the template", () => {
    assert.equal(shouldSkipVoiceClosureCustomerReplyWake("כן", historyBeforeKen), true)
    assert.equal(shouldRecordVoiceClosureTemplate(historyBeforeKen), false)
  })

  it("pre-turn binds bare כן to human_sales — not service voice template path", () => {
    const result = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history: historyBeforeKen,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_sales")
    assert.doesNotMatch(result.reply, /WhatsApp \/ אימייל בלבד/)
  })

  it("still wakes on first היי when template is the only assistant message", () => {
    const openingHistory: HistoryMessage[] = [
      { role: "assistant", content: PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY },
    ]
    assert.equal(shouldSkipVoiceClosureCustomerReplyWake("היי", openingHistory), false)
    assert.equal(shouldRecordVoiceClosureTemplate([]), true)
    assert.equal(shouldRecordVoiceClosureTemplate(openingHistory), false)
  })
})
