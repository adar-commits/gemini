import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isExchangeOriginalPackagingPolicyPending } from "@/lib/agents/exchange-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const PACKAGING_BARRIER = "השטיח לא באריזה שלו"

const BAD_INVENTORY_PIVOT =
  "כדי לבדוק מלאי של לא בסניף וט, אצטרך את המק״ט של המוצר (לדוגמה: 31503138-200290)."

function historyThroughPackagingBarrier(): HistoryMessage[] {
  return [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content: "*הום בוט :)* היי שוב! 🙂 במה אפשר לעזור?",
    },
    {
      role: "user",
      content: "קיבלתי את השטיחים ואחד מהם קטן לי יש סיכוי להחליף לגדול יותר",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כן, אפשר להחליף למידה גדולה יותר ההחלפה אפשרית תוך 14 יום מקבלת השטיח, ללא שימוש ובאריזתו המקורית. אפשר להחליף באחד מסניפי הרשת או עם שליח, בתשלום לפי גודל השטיח. נמשיך עם החלפה בהזמנה SO26023523. איזה מהשטיחים רוצים להחליף, והאם מדובר באותו דגם ובאותו צבע רק במידה גדולה יותר? אם יש את המק״ט של המידה הרצויה (לדוגמה: 31503138-200290), אפשר לשלוח אותו כאן.",
    },
    { role: "user", content: PACKAGING_BARRIER },
  ]
}

/** Replay 533332336 — size exchange + missing original packaging must not pivot to inventory SKU. */
describe("exchange packaging barrier (533332336)", () => {
  it("detects original-packaging policy pending from bot last message", () => {
    const history = historyThroughPackagingBarrier()
    assert.equal(isExchangeOriginalPackagingPolicyPending(history), true)
  })

  it("emits packaging barrier hint instead of inventory pivot", () => {
    const history = historyThroughPackagingBarrier()
    const body = history.at(-1)?.content ?? ""
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /533332336/)
    assert.match(hints, /Never lookup_inventory/)
    assert.match(hints, /human_sales/)
  })

  it("the bad reply pivoted to branch inventory SKU lookup", () => {
    assert.match(BAD_INVENTORY_PIVOT, /מק״ט/)
    assert.match(BAD_INVENTORY_PIVOT, /מלאי/)
  })
})
