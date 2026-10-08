import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractExchangeIntake,
  isExchangeSkuPending,
} from "@/lib/agents/exchange-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { executeCreateSwitchRequest } from "@/lib/hom-agent/tools/switch-request"
import type { HistoryMessage } from "@/lib/agents/types"

const KIND_MENU =
  "*הום בוט :)*\nבדקתי, המשלוח סומן כנמסר. נמשיך עם השינוי — איזה סוג החלפה מתאים?\n1. *אותו דגם, צבע אחר*\n2. *אותו דגם וצבע, מידה/צורה אחרת*\n3. *דגם/שטיח אחר לגמרי*"

const SKU_ASK_PARAPHRASE =
  "*הום בוט :)*\nמעולה נטלי, אז מחליפים ל-Sunny Joy בצבע בז׳\nיש לך את המק״ט של הבז׳ מהאתר? (לדוגמה: 31503138-200290)\nאם אין, זה בסדר, אפשר להמשיך גם בלעדיו."

function historyBeforeHi(): HistoryMessage[] {
  return [
    { role: "user", content: "הזמנה 77785 Sunny Joy צהוב — רוצה להחליף לבז׳" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\n(מס' הזמנה 77785)\nהמשלוח סומן כנמסר. זו ההזמנה?",
    },
    { role: "user", content: "כן" },
    { role: "assistant", content: KIND_MENU },
    { role: "user", content: "1" },
    { role: "assistant", content: SKU_ASK_PARAPHRASE },
  ]
}

describe("exchange SKU greeting 533511440", () => {
  it("detects paraphrased SKU question and menu digit kind", () => {
    const history = historyBeforeHi()
    assert.equal(isExchangeSkuPending(history), true)
    const intake = extractExchangeIntake(history, "הי")
    assert.equal(intake.exchangeKind, "same_model_color")
    assert.equal(intake.skuQuestionSent, true)
  })

  it("hints bind short hello to continue exchange, not premature sales handoff", () => {
    const hints = buildConversationHints({
      body: "הי",
      history: historyBeforeHi(),
      phone: "+972542962965",
    })
    assert.match(hints ?? "", /EXCHANGE SKU PENDING \(533511440/)
    assert.match(hints ?? "", /Never.*human_sales/i)
  })

  it("blocks create_switch_request on greeting while SKU pending", async () => {
    const tool = await executeCreateSwitchRequest({
      body: "הי",
      phone: "+972542962965",
      history: historyBeforeHi(),
      exchangeKind: "same_model_color",
    })
    assert.equal(tool.ok, false)
    if (tool.ok) return
    assert.match(tool.error, /greeting\/ping/i)
  })
})
