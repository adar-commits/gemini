import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isConversationClosing,
  looksLikeThanksTypo,
} from "@/lib/agents/conversation-close"
import { buildUncertainHandoffReply } from "@/lib/agent-core/fallbacks"
import { isSalesQuizContext } from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"

describe("looksLikeThanksTypo", () => {
  it("accepts common thanks typos", () => {
    assert.equal(looksLikeThanksTypo("תוזה"), true)
    assert.equal(looksLikeThanksTypo("טודה"), true)
    assert.equal(isConversationClosing("תוזה"), true)
  })

  it("does not treat unrelated short text as thanks", () => {
    assert.equal(looksLikeThanksTypo("סלון"), false)
    assert.equal(isConversationClosing("סלון"), false)
  })
})

describe("buildUncertainHandoffReply", () => {
  it("rephrases the customer and offers human handoff", () => {
    const reply = buildUncertainHandoffReply("משהו לא ברור")
    assert.match(reply, /משהו לא ברור/)
    assert.match(reply, /נציג שירות/)
  })
})

describe("isSalesQuizContext after inventory", () => {
  it("does not treat inventory lookup thread as sales quiz", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "42000057-120170" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי זמינות לדגם 42000057-120170:\n\n*יש במלאי:*\n• נתניה",
      },
    ]
    assert.equal(isSalesQuizContext(history, "sales"), false)
  })
})
