import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildHumanHandoffConfirmedReply,
  enrichHandoffReply,
} from "@/lib/agents/human-agent-hours"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { shouldSilentAutoAssignOnQuietWindow } from "@/lib/agents/inactivity-policy"
import type { HistoryMessage } from "@/lib/agents/types"

/** 534053369 — customer must see that the chat was assigned to a human rep. */
describe("handoff assignment ack 534053369", () => {
  const serviceSummaryHistory: HistoryMessage[] = [
    { role: "user", content: "יש בעיה בשטיח" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמסכם את הפנייה עבור נציג שירות:\n• SO26024002\n• דיווח על בעיה\n\nזה מדויק?",
    },
  ]

  it("detects quiet-window service summary for auto-assign", () => {
    assert.equal(shouldSilentAutoAssignOnQuietWindow(serviceSummaryHistory, "service"), true)
  })

  it("auto-assign recovery reply tells the customer the chat was transferred", () => {
    const at1400 = new Date("2026-09-09T11:00:00.000Z")
    const reply = `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply("human_service", at1400)}`
    assert.match(reply, /העברתי את השיחה לנציג שירות/)
    assert.ok(reply.startsWith(CUSTOMER_HEADER))
  })

  it("runtime finish adds transfer ack when the model handoffs without it", () => {
    const at1400 = new Date("2026-09-09T11:00:00.000Z")
    const reply = enrichHandoffReply("בסדר, אעדכן את הנציג.", "human_service", at1400)
    assert.match(reply, /העברתי את השיחה לנציג שירות/)
  })
})
