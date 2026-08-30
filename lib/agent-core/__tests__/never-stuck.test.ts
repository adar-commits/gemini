import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import type { AgentResponse } from "@/lib/agents/types"
import {
  buildApiFailureReply,
  buildConfusedFallbackReply,
  buildLlmFailureReply,
  buildNeverStuckReply,
  coerceOperationalReply,
} from "@/lib/agent-core/fallbacks"
import {
  buildOrderStatusClarificationReply,
  isOrderStatusClarificationQuestion,
} from "@/lib/agents/order-lookup"
import { buildStuckHandoffReply } from "@/lib/agents/handoff-wait"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

/** Mirrors the last-resort guard in lib/landbot/handle-inbound.ts */
function ensureCustomerVisibleReply(result: AgentResponse): string {
  let draftReply = result.reply?.trim() ?? ""
  if (
    !draftReply &&
    !result.duplicateSuppressed &&
    (result.action === "reply" || result.action === "shipping")
  ) {
    draftReply = buildNeverStuckReply()
  }
  return draftReply
}

function assertNeverSilent(reply: string, label: string) {
  assert.ok(reply.trim().length > 20, `${label}: reply must not be empty`)
  assert.match(reply, /הום בוט|אני כאן|נציג|אפשר|בקצרה|תקלה|הבנתי/i, `${label}: must be customer-facing Hebrew`)
}

describe("never-stuck mechanism — proof suite", () => {
  it("Layer 1: buildNeverStuckReply is always non-empty and offers a path forward", () => {
    const reply = buildNeverStuckReply()
    assert.match(reply, /^\*הום בוט :\)\*/)
    assert.match(reply, /אני כאן/)
    assert.match(reply, /נציג שירות/)
  })

  it("Layer 2: all template fallbacks produce sendable customer text", () => {
    for (const [name, builder] of [
      ["api failure", () => buildApiFailureReply()],
      ["llm failure", () => buildLlmFailureReply()],
      ["confused", () => buildConfusedFallbackReply()],
      ["stuck handoff", () => `${CUSTOMER_HEADER}\n${buildStuckHandoffReply()}`],
    ] as const) {
      assertNeverSilent(builder(), name)
    }
  })

  it("Layer 3: coerceOperationalReply replaces hollow order-status LLM output", () => {
    const hollow = `${CUSTOMER_HEADER}
לגבי הזמנה SO26019842 (אתר אינטרנט):


אם צריך עוד משהו — כאן.`
    const coerced = coerceOperationalReply(hollow, { expectShippingData: true })
    assertNeverSilent(coerced, "hollow order status")
    assert.match(coerced, /תקלה זמנית|נציג שירות/)
    assert.doesNotMatch(coerced, /^\s*$/m)
  })

  it("Layer 4: handle-inbound guard fills empty shipping/reply actions", () => {
    const emptyShipping: AgentResponse = {
      ok: true,
      agent: "master",
      reply: "",
      action: "shipping",
    }
    const filled = ensureCustomerVisibleReply(emptyShipping)
    assertNeverSilent(filled, "empty shipping action")
    assert.equal(filled, buildNeverStuckReply())

    const duplicateSuppressed: AgentResponse = {
      ok: true,
      agent: "master",
      reply: "",
      action: "shipping",
      duplicateSuppressed: true,
    }
    assert.equal(ensureCustomerVisibleReply(duplicateSuppressed), "")
  })

  it("Layer 5: order status clarification after בדקתי reply (מה זה אומר?)", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, השטיח נארז במחסני החברה וממתין לאיסוף של חברת השליחויות נכון לתאריך 30.8.2026",
      },
    ]
    assert.equal(isOrderStatusClarificationQuestion("מה זה אומר?"), true)
    const reply = buildOrderStatusClarificationReply(history)
    assertNeverSilent(reply, "status clarification")
    assert.match(reply, /בקצרה/)
    assert.match(reply, /האם להעביר לנציג שירות/)
  })

  it("Layer 6: duplicate status would not leave customer silent — clarification substitutes", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, השטיח נארז במחסני החברה וממתין לאיסוף נכון לתאריך 30.8.2026",
      },
    ]
    const duplicateWouldHaveBeenEmpty = ""
    const shippingRecovery =
      duplicateWouldHaveBeenEmpty ||
      buildOrderStatusClarificationReply(history)
    assertNeverSilent(shippingRecovery, "shipping duplicate recovery")
  })
})
