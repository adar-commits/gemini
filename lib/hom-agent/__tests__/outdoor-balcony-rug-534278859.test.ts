import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isOutdoorBalconyRugConsultation,
  isOutdoorBalconyRugThread,
  isSalesConsultationTrigger,
} from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "השטיחי חוץ שיש לכם למרפסת ולגינה עמידים למים?"

const SIZING_TURN =
  "מה הגודל המומלץ? יש לנו מרפסת פנטהאוז אך חשבנו רק לאזור של פינת הישיבה"

const WRONG_REPLY =
  "את המידה המדויקת לפינת הישיבה יועץ המכירות ימליץ לכם, לפי המידות והסידור של הריהוט. כדי שתהיה לו נקודת התחלה: מה בערך המידות של פינת הישיבה"

/** 534278859 — outdoor balcony rug sizing must route to sales intake, not FAQ-only. */
describe("outdoor balcony rug 534278859", () => {
  it("prompt teaches sales intake for outdoor/balcony rug, not FAQ-only", () => {
    const line = prompt.split("\n").find((l) => l.includes("534278859"))
    assert.ok(line, "missing outdoor balcony rug rule")
    assert.match(line!, /מכירות|sales/i)
    assert.match(line!, /never.*FAQ-only|לא.*FAQ/i)
    assert.match(line!, /human_service/)
  })

  it("detects outdoor rug consultation from customer wording", () => {
    assert.equal(isOutdoorBalconyRugConsultation(OPENING), true)
    assert.equal(isOutdoorBalconyRugConsultation(SIZING_TURN), true)
    assert.equal(isSalesConsultationTrigger(SIZING_TURN), true)
  })

  it("detects outdoor rug thread from history", () => {
    const history = [
      { role: "user" as const, content: OPENING },
      {
        role: "assistant" as const,
        content:
          "*הום בוט :)* שטיחי החוץ שלנו בנויים לתנאי חוץ. מה בערך גודל השטח במרפסת?",
      },
    ]
    assert.equal(isOutdoorBalconyRugThread(history), true)
  })

  it("hints sales opening on sizing turn — not FAQ-only or human_service", () => {
    const history = [
      { role: "user" as const, content: "היי" },
      { role: "user" as const, content: OPENING },
      {
        role: "assistant" as const,
        content:
          "*הום בוט :)* שטיחי החוץ שלנו בנויים לתנאי חוץ. מה בערך גודל השטח במרפסת?",
      },
    ]
    const hints = buildConversationHints({ history, body: SIZING_TURN })
    assert.notEqual(hints, null)
    assert.match(hints!, /OUTDOOR BALCONY RUG OPENING \(534278859\)/)
    assert.match(hints!, /crm_department.*sales/)
    assert.match(hints!, /never FAQ-only/)
    assert.match(hints!, /never human_service/)
  })

  it("wrong FAQ-only deferral pattern is not the taught path", () => {
    assert.doesNotMatch(WRONG_REPLY, /action:\s*human_sales/i)
    assert.match(WRONG_REPLY, /יועץ המכירות/)
  })
})
