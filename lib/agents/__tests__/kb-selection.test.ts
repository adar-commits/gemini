import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { selectFaqKb } from "@/lib/agents/kb"

describe("selectFaqKb", () => {
  it("includes exchange fee table when customer asks about החלפה", () => {
    const kb = selectFaqKb("מה מדיניות החלפה לשטיח?")
    assert.match(kb, /160\*230: 85 ILS/)
    assert.match(kb, /300\*400: 300 ILS/)
  })

  it("includes refund/exchange section in default slice when user text is empty", () => {
    const kb = selectFaqKb("")
    assert.match(kb, /Home pickup\/delivery fees/)
    assert.match(kb, /300\*400: 300 ILS/)
  })
})
