import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BAD_HANDOFF_REPLY =
  "*הום בוט :)* בשמחה רז. העברתי עכשיו את הפנייה לנציג שירות ושמתי בה בקשה שיתקשר אליך.\n\n• מס׳ הזמנה: SO26023279\n\nמעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

/** Replay 533843643 — explicit callback ask after service handoff; one transfer line only. */
describe("service callback handoff (533843643)", () => {
  it("hints service callback ask after prior human_service", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "בוקר טוב, סיפקו את השטיח הלא נכון." },
      {
        role: "assistant",
        content:
          "*הום בוט :)* מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם.",
      },
    ]
    const hints = buildConversationHints({
      history,
      body: "אשמח שנציג יתקשר אלי",
      whatsappPhone: "+972545533279",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SERVICE CALLBACK ASK AFTER HANDOFF \(533843643\)/)
    assert.match(hints!, /one.*transfer sentence/i)
    assert.match(hints!, /never.*מעולה, העברתi/i)
  })

  it("flags production duplicate transfer closing", () => {
    const transferPhrases =
      BAD_HANDOFF_REPLY.match(/העברתי|מעביר/gi) ?? []
    assert.ok(transferPhrases.length >= 2)
    assert.match(BAD_HANDOFF_REPLY, /מעולה, העברתי את השיחה/)
  })
})
