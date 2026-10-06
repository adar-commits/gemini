import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isOrderProductIdentityQuestion } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING = "רוצה לדעת איזה שטיח זה אבל"
const MATERIAL = "וממה הוא עשוי"
const COMBINED = `${OPENING}\n${MATERIAL}\n???`

const WRONG_REPLY =
  "*הום בוט :)* סליחה נטלי, בהודעה הקודמת שלחתי רק את סטטוס ההזמנה ולא את מה שביקשת. כרגע אין נציגי שירות זמינים (שעות הפעילות א'-ה' 09:00-16:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות."

function history294198093(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "user", content: MATERIAL },
    { role: "user", content: "???" },
  ]
}

/** 294198093 — product identity/material on order must lookup line items, not after-hours handoff alone. */
describe("order product identity 294198093", () => {
  it("detects which-carpet and material questions on an order", () => {
    assert.equal(isOrderProductIdentityQuestion(OPENING), true)
    assert.equal(isOrderProductIdentityQuestion(MATERIAL), true)
    assert.equal(isOrderProductIdentityQuestion(COMBINED), true)
    assert.equal(isOrderProductIdentityQuestion("איזה שטיח לשים מתחת למיטה זוגית"), false)
    assert.equal(isOrderProductIdentityQuestion("איפה המשלוח שלי"), false)
  })

  it("prompt teaches lookup before handoff and line-item answer", () => {
    const line = prompt.split("\n").find((l) => l.includes("294198093"))
    assert.ok(line, "missing order product identity rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /line items|product name/i)
    assert.match(line!, /never.*human_service|human_service.*lookup/i)
  })

  it("hints lookup_order_status — never handoff without product answer", () => {
    const hints =
      buildConversationHints({
        history: history294198093(),
        body: COMBINED,
        whatsappPhone: "+9725210452526",
      }) ?? ""
    assert.match(hints, /294198093/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /line items/)
    assert.match(hints, /Never apologize and hand off without lookup/)
  })

  it("wrong production reply skipped lookup and went straight to after-hours handoff", () => {
    assert.match(WRONG_REPLY, /אין נציגי שירות/)
    assert.match(WRONG_REPLY, /סטטוס ההזמנה/)
    assert.doesNotMatch(WRONG_REPLY, /lookup_order_status/)
    assert.doesNotMatch(WRONG_REPLY, /שטיח|דגם|פריט/)
  })
})
