import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "היי קיבלתי שוב מייל לדרג את השטיח והוא עדיין לא הגיע"

const BAD_FAQ_REPLY =
  "*הום בוט :)*\nבדקתי, המשלוח סומן כנמסר באמצעות שליח. נכון לתאריך 11/10/2026 בשעה 12:19 שמחתי לעזור!"

const GOOD_HANDOFF =
  "*הום בוט :)*\nמבין, יערה. לפי המערכת השטיח סומן כנמסר על ידי השליח היום (11/10) בשעה 12:19, ואת אומרת שהוא לא הגיע אלייך.\n\nמעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

/** Replay 534100267 — rating email + non-arrival must not FAQ warm-close on opener. */
describe("rating email non-receipt opener 534100267", () => {
  it("prompt teaches lookup — not נמסר + שמחתי לעזור on opener", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("534100267") && l.includes("מייל לדרג"))
    assert.ok(line, "missing 534100267 rating-email non-receipt rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /שמחתי לעזור/)
  })

  it("hints order-status opening on first turn", () => {
    const history: HistoryMessage[] = [{ role: "user", content: OPENING }]
    const hints =
      buildConversationHints({
        body: OPENING,
        history,
      }) ?? ""
    assert.match(hints, /534100267/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /שמחתי לעזור/)
  })

  it("bad FAQ warm-close is not the taught first-turn path", () => {
    assert.match(BAD_FAQ_REPLY, /שמחתי לעזור/)
    assert.doesNotMatch(BAD_FAQ_REPLY, /לא הגיע אלייך/)
  })

  it("follow-up non-receipt handoff wording is valid", () => {
    assert.match(GOOD_HANDOFF, /העברתי.*נציג/)
    assert.match(GOOD_HANDOFF, /לא הגיע/)
  })
})
