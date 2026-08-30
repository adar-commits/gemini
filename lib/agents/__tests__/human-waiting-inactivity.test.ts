import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSkipInactivityForHumanWait } from "@/lib/agents/human-waiting"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

describe("shouldSkipInactivityForHumanWait", () => {
  it("skips after human_service assignment", () => {
    assert.equal(
      shouldSkipInactivityForHumanWait({
        lastAction: "human_service",
        lastAssistantText: `${CUSTOMER_HEADER}\nהפנייה הועברה לנציג שירות. ניצור קשר בהקדם.`,
      }),
      true
    )
  })

  it("skips while handoff offer is pending", () => {
    assert.equal(
      shouldSkipInactivityForHumanWait({
        lastAction: "reply",
        lastAssistantText:
          "אוקיי במקרה כזה אצטרך להעביר אותך לנציג שירות אנושי,בסדר?",
      }),
      true
    )
  })

  it("skips after handoff confirmation copy", () => {
    assert.equal(
      shouldSkipInactivityForHumanWait({
        lastAction: "reply",
        lastAssistantText: `${CUSTOMER_HEADER}\nהפנייה הועברה לנציג שירות. ניצור קשר בהקדם.`,
      }),
      true
    )
  })

  it("keeps inactivity for normal bot questions", () => {
    assert.equal(
      shouldSkipInactivityForHumanWait({
        lastAction: "reply",
        lastAssistantText: `${CUSTOMER_HEADER}\nהאם מספר הטלפון 054-7495083 נכון?`,
      }),
      false
    )
  })
})
