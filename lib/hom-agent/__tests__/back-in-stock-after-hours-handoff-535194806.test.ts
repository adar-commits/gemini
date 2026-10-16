import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isBackInStockReferenceConfirmPending,
  isBackInStockSalesHandoffThread,
} from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "היי, אשמח לקבל עדכון כשהמידה M - 140*190 של שטיח רייס בז' RACE חוזרת למלאי"

const BOT_STEP1 =
  "*הום בוט :)*\nהיי נועם! 😊 קיבלנו את הבקשה שלך לעדכון כששטיח רייס בז' RACE במידה M ‏(140*190) יחזור למלאי.\n\nבינתיים, אולי אוכל לעניין אותך בשטיח דומה?"

const BOT_REFERENCE =
  "*הום בוט :)*\nבשמחה! 🙂 רק לוודא: שטיח רייס בז' RACE במידה 140*190 הוא הרפרנס הנכון למידה ולצורה?"

function historyBeforeConfirm(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: BOT_STEP1 },
    { role: "user", content: "אשמח" },
    { role: "assistant", content: BOT_REFERENCE },
  ]
}

/** Replay 535194806 — step-3 human_sales must not paste after-hours boilerplate in reply. */
describe("back-in-stock after-hours handoff 535194806", () => {
  it("detects reference confirm pending before step-3 handoff", () => {
    assert.equal(isBackInStockReferenceConfirmPending(historyBeforeConfirm()), true)
    assert.equal(isBackInStockSalesHandoffThread(historyBeforeConfirm()), false)
  })

  it("hint binds נכון to human_sales without offline duplicate text", () => {
    const hints = buildConversationHints({
      body: "נכון",
      history: historyBeforeConfirm(),
    })
    assert.match(hints ?? "", /BACK-IN-STOCK STEP3 CONFIRM/)
    assert.match(hints ?? "", /human_sales/)
    assert.match(hints ?? "", /empty `reply`/)
    assert.match(hints ?? "", /אין יועצי/)
  })
})
