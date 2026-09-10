import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildLlmFailureReply } from "@/lib/agent-core/fallbacks"
import {
  isExplicitHumanHandoffRequest,
  isHumanHandoffPending,
  resolveLlmUnavailableHandoff,
} from "@/lib/agents/off-topic"
import type { HistoryMessage } from "@/lib/agents/types"

const llmFailureHistory: HistoryMessage[] = [
  {
    role: "assistant",
    content: buildLlmFailureReply(),
  },
]

describe("resolveLlmUnavailableHandoff", () => {
  it("treats LLM failure reply as a pending handoff offer", () => {
    assert.equal(isHumanHandoffPending(llmFailureHistory), true)
  })

  it("hands off on כן after LLM failure offer", () => {
    assert.equal(resolveLlmUnavailableHandoff("כן", llmFailureHistory), "human_service")
  })

  it("hands off on explicit transfer request without LLM", () => {
    assert.equal(
      resolveLlmUnavailableHandoff("תעביר לנציג", llmFailureHistory),
      "human_service"
    )
    assert.equal(
      resolveLlmUnavailableHandoff("נציג שירות", llmFailureHistory),
      "human_service"
    )
  })

  it("hands off on continuation phrases after transfer offer", () => {
    assert.equal(resolveLlmUnavailableHandoff("שימשיך", llmFailureHistory), "human_service")
    assert.equal(
      resolveLlmUnavailableHandoff("שהנציג ימשיך", llmFailureHistory),
      "human_service"
    )
  })

  it("does not hand off on unrelated text without pending offer", () => {
    assert.equal(resolveLlmUnavailableHandoff("כן", []), null)
    assert.equal(resolveLlmUnavailableHandoff("מה שעות הסניף?", llmFailureHistory), null)
  })
})

describe("isExplicitHumanHandoffRequest", () => {
  it("detects common rep-request phrases", () => {
    assert.equal(isExplicitHumanHandoffRequest("תעביר טיפול לנציג אנושי"), true)
    assert.equal(isExplicitHumanHandoffRequest("נציג"), true)
    assert.equal(isExplicitHumanHandoffRequest("נציג שירות"), true)
    assert.equal(isExplicitHumanHandoffRequest("כן"), false)
  })
})
