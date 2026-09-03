import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPriorityApiWaitMessage,
  PRIORITY_API_PREMESSAGE,
} from "@/lib/agents/priority-webhook"

describe("priority api wait copy", () => {
  it("uses soft few-moments wording in pre-message", () => {
    assert.match(PRIORITY_API_PREMESSAGE, /עוד כמה רגעים/)
    assert.doesNotMatch(PRIORITY_API_PREMESSAGE, /רגע קט|שני/)
  })

  it("detects current and legacy wait bubbles in history", () => {
    assert.equal(
      isPriorityApiWaitMessage("*הום בוט :)*\nאני על זה — עוד כמה רגעים 🙏"),
      true
    )
    assert.equal(
      isPriorityApiWaitMessage("אני על זה, כמה רגעים בבקשה.."),
      true
    )
  })
})
