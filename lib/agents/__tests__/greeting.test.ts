import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildGreetingReply,
  dedupeGreetingBotName,
  sanitizeBotGenderSlashes,
} from "@/lib/agents/greeting"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

describe("greeting reply", () => {
  it("uses masculine voice and a single bot name", () => {
    const reply = buildGreetingReply()
    assert.match(reply, /^(\*הום בוט :\)\*\n)/)
    assert.match(reply, /שמח שפניתם/)
    assert.doesNotMatch(reply, /שמח\/ה/)
    assert.doesNotMatch(reply, /כאן הום בוט/)
  })

  it("sanitizes slash gender forms from LLM output", () => {
    assert.equal(
      sanitizeBotGenderSlashes("שמח/ה שפניתם — מצטער/ת לשמוע"),
      "שמח שפניתם — מצטער לשמוע"
    )
  })

  it("removes duplicate bot name after the header", () => {
    const noisy = `${CUSTOMER_HEADER}
היי! כאן הום בוט :)
שמח/ה שפניתם — במה אוכל לעזור היום?`
    const cleaned = dedupeGreetingBotName(sanitizeBotGenderSlashes(noisy))
    assert.doesNotMatch(cleaned, /כאן הום בוט/)
    assert.match(cleaned, /שמח שפניתם/)
  })
})
