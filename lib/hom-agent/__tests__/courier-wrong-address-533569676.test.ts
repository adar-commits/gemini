import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isActiveCourierWrongAddressReport } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** 533569676 — courier en route with wrong address routed to FAQ instead of service. */
describe("courier wrong address 533569676", () => {
  const opening =
    "צלצל שליח למסור את השטיח והכתובת שמופיע לשליח לא נכונה"
  const history: HistoryMessage[] = [
    { role: "user", content: "בוקר טוב" },
    { role: "assistant", content: "*הום בוט :)* בוקר טוב! 😊 במה אפשר לעזור?" },
  ]

  it("detects active courier wrong-address report", () => {
    assert.equal(isActiveCourierWrongAddressReport(opening), true)
    assert.equal(
      isActiveCourierWrongAddressReport("היי, אני צריכה לשנות את הכתובת למשלוח"),
      false
    )
  })

  it("prompt teaches service path, not FAQ-only courier script", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Active courier — wrong address"))
    assert.ok(line, "missing active courier wrong address rule")
    assert.match(line!, /Service/)
    assert.match(line!, /human_service/)
    assert.match(prompt, /533569676/)
  })

  it("hints service urgency on opening turn", () => {
    const hints = buildConversationHints({
      history,
      body: opening,
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /ACTIVE COURIER WRONG ADDRESS \(533569676/)
    assert.match(hints!, /crm_department service/)
    assert.match(hints!, /lookup_order_status/)
    assert.match(hints!, /Never reply with ONLY 077-9725055/)
    assert.doesNotMatch(hints!, /SHIPPING ADDRESS UPDATE \(532692073/)
  })
})
