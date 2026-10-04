import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isSkuCorrectionAfterStockAnswer,
} from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const WRONG_REPLY =
  "אין בעיה! אז לגבי סידני 02 קרם-בז' במידה 200*290 (מק״ט 31502091-200290): כרגע אין מלאי, אבל אפשר כבר להזמין אותו בהזמנה מוקדמת. הצפי שיגיע למלאי הוא 15/11/2026. בכיף, ערב טוב"

/** Replay 534109519 — SKU typo correction after stock answer must not re-lookup or warm-close. */
describe("sku correction after stock 534109519", () => {
  const historyBeforeCorrection: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי מה נשמע? רציתי לדעת אם שטיח סידני 02 קרם-בז' SYDNEY מידה 200*290 אמור לחזור למלאי בקרוב?",
      agent: null,
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי טל! כדי לבדוק את סידני 02 קרם-בז' במידה 200*290 צריך את המק״ט של המידה הזו. הוא מופיע בעמוד המוצר באתר (לדוגמה: 31503138-200290). אפשר לשלוח לי אותו כאן?",
      agent: "faq",
    },
    { role: "user", content: "31502091-80150", agent: null },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בדקתי זמינות לדגם 31502091-80150 בסניפים. לפי הנתונים במערכת לא מופיע מלאי כרגע — כדאי לפנות לסניף לוודא. האם להעביר ליועץ מכירות שיבדוק ויאמת?",
      agent: "sales",
    },
    { role: "user", content: "31502091-200290", agent: null },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בדקתי זמינות לדגם 31502091-200290: הדגם זמין כרגע להזמנה מוקדמת. צפי הגעה: 2026-11-15 שמחתי לעזור!",
      agent: "faq",
    },
  ]

  const correction = "סליחה - זה המק״ט הנכון"

  it("prompt teaches SKU correction after stock — no re-lookup or warm-close", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("SKU correction") && l.includes("534109519"))
    assert.ok(line, "missing SKU correction rule")
    assert.match(line!, /never.*lookup_inventory/i)
    assert.match(line!, /never.*warm-close/i)
  })

  it("detects correction turn from thread state", () => {
    assert.equal(isSkuCorrectionAfterStockAnswer(historyBeforeCorrection, correction), true)
    assert.equal(
      isSkuCorrectionAfterStockAnswer(historyBeforeCorrection, "31502091-200290"),
      false
    )
    assert.equal(
      isSkuCorrectionAfterStockAnswer(historyBeforeCorrection, "תבדוק שוב בבקשה"),
      false
    )
  })

  it("hints forbid re-lookup and warm-close on correction", () => {
    const hints = buildConversationHints({
      history: historyBeforeCorrection,
      body: correction,
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SKU CORRECTION AFTER STOCK \(534109519\)/)
    assert.match(hints!, /never.*lookup_inventory/i)
    assert.match(hints!, /never.*warm-close/i)
    assert.doesNotMatch(hints!, /INVENTORY SKU PROVIDED/)
  })

  it("wrong pivot reply pattern is absent from expected playbook", () => {
    assert.match(WRONG_REPLY, /ערב טוב/)
    assert.doesNotMatch(WRONG_REPLY, /כבר בדקתי/)
  })
})
