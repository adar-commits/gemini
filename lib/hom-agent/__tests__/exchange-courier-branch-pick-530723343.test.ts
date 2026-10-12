import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  isExchangeCourierPathCommitted,
  isExchangeCourierUndecidedTargetTurn,
  isExchangeIntakeActive,
} from "@/lib/agents/exchange-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const H = "*הום בוט :)*\n"

/** Replay 530723343 — courier exchange must not pivot to branch-only after «אגיע לסניף לבחור». */
describe("exchange courier branch pick (530723343)", () => {
  const historyThroughTargetQuestion = (): HistoryMessage[] => [
    {
      role: "assistant",
      content: `${H}היי Noa, שמח שהשטיח הגיע. אם הוא לא מתאים לך, יש שתי אפשרויות: 1. *החלפה* … 2. *החזרה וביטול* …`,
    },
    { role: "user", content: "אז איך אפשר להזמין שליח שיבוא לקחת ? החלפה" },
    {
      role: "assistant",
      content: `${H}בכיף Noa, נמשיך עם החלפה עם שליח … רק לוודא: מדובר בהזמנה #76132, ויקטוריאן אפור 290*200?`,
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content: `${H}בדקתי, לגבי הזמנה SO26021029 הסטטוס במערכת: נמסר.`,
    },
    { role: "user", content: "אז מה עושים" },
    {
      role: "assistant",
      content: `${H}בשמחה Noa, ככה זה עובד: … מה תרצי להחליף, את הדגם, הצבע או המידה? ואם כבר יש שטיח שבחרת, איזה?`,
    },
  ]

  it("thread state: courier path committed through order confirm", () => {
    const history = historyThroughTargetQuestion()
    assert.equal(isExchangeIntakeActive(history), true)
    assert.equal(isExchangeCourierPathCommitted(history), true)
  })

  it("hints block branch-only pivot when customer will pick at branch", () => {
    const history = historyThroughTargetQuestion()
    const body = "דגם ומידה אין עדיין שטיח אגיע אליכם לסניף לבחור"
    assert.equal(isExchangeCourierUndecidedTargetTurn(history, body), true)
    const hints = buildConversationHints({ body, history, phone: "+97250867627" })
    assert.match(hints ?? "", /EXCHANGE COURIER PICK AT BRANCH \(530723343\)/i)
    assert.match(hints ?? "", /Never get_branch_info \+ action end/i)
    assert.match(hints ?? "", /human_sales/i)
  })

  it("prompt teaches courier path survives branch catalog visit", () => {
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    assert.match(prompt, /530723343/)
    assert.match(prompt, /pick model\/size at a branch/i)
  })
})
