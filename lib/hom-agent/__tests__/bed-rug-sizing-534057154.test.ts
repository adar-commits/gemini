import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isBedRugSizingConsultation,
  isSalesConsultationTrigger,
} from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "רציתי לדעת איזה שטיח לשים מתחת למיטה זוגית\nאיזה גודל"

const WRONG_REPLY =
  "שאלה טובה — את המידה המדויקת יתאים לך יועץ המכירות לפי החדר. בינתיים אפשר להיעזר במדריך המידות"

/** 534057154 — bed rug sizing ask must route to sales intake, not FAQ-only links. */
describe("bed rug sizing opening 534057154", () => {
  it("prompt teaches sales intake for bed rug sizing, not FAQ-only", () => {
    const line = prompt.split("\n").find((l) => l.includes("534057154"))
    assert.ok(line, "missing bed rug sizing rule")
    assert.match(line!, /מכירות|sales/i)
    assert.match(line!, /never.*FAQ-only|לא.*FAQ/i)
    assert.match(line!, /human_service/)
  })

  it("detects bed rug sizing consultation from customer wording", () => {
    assert.equal(isBedRugSizingConsultation(OPENING), true)
    assert.equal(isSalesConsultationTrigger(OPENING), true)
  })

  it("hints sales opening — not service or FAQ-only", () => {
    const history = [
      { role: "user" as const, content: "היי" },
      {
        role: "assistant" as const,
        content: "*הום בוט :)* היי! 😊 במה אפשר לעזור?",
      },
    ]
    const hints = buildConversationHints({ history, body: OPENING })
    assert.notEqual(hints, null)
    assert.match(hints!, /BED RUG SIZING OPENING \(534057154\)/)
    assert.match(hints!, /crm_department.*sales/)
    assert.match(hints!, /never FAQ-only/)
    assert.match(hints!, /never human_service/)
  })

  it("wrong FAQ-only reply pattern is not the taught path", () => {
    assert.doesNotMatch(WRONG_REPLY, /action:\s*human_sales/i)
    assert.match(WRONG_REPLY, /מדריך המידות/)
  })
})
