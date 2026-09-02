import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isAssignedToHumanAgent,
  isConfiguredHumanAgentId,
  shouldDeferToHumanAgent,
} from "@/lib/landbot/human-takeover"
import {
  isAgentChat,
  isCustomerChat,
  isLandbotEvent,
  parseLandbotHookMessage,
} from "@/lib/landbot/parse-webhook"

describe("shouldDeferToHumanAgent", () => {
  it("defers when Landbot assigns a configured human rep", () => {
    const prevSales = process.env.LANDBOT_HUMAN_AGENT_SALES_IDS
    process.env.LANDBOT_HUMAN_AGENT_SALES_IDS = "40684,999"
    try {
      assert.equal(isConfiguredHumanAgentId(40684), true)
      assert.equal(
        shouldDeferToHumanAgent({ assignedAgentId: 40684, humanAgentLastAt: null, lastUserAt: null }),
        true
      )
    } finally {
      process.env.LANDBOT_HUMAN_AGENT_SALES_IDS = prevSales
    }
  })

  it("defers when a human spoke after the previous customer message", () => {
    assert.equal(
      shouldDeferToHumanAgent({
        assignedAgentId: null,
        humanAgentLastAt: "2026-09-02T15:05:00.000Z",
        lastUserAt: "2026-09-02T15:00:00.000Z",
      }),
      true
    )
  })

  it("keeps deferring after the customer replies while human still owns the thread", () => {
    assert.equal(
      shouldDeferToHumanAgent({
        assignedAgentId: null,
        humanAgentLastAt: "2026-09-02T15:00:00.000Z",
        lastUserAt: "2026-09-02T15:05:00.000Z",
      }),
      true
    )
  })

  it("does not treat unknown agent ids as human reps", () => {
    const prevSales = process.env.LANDBOT_HUMAN_AGENT_SALES_IDS
    const prevService = process.env.LANDBOT_HUMAN_AGENT_SERVICE_IDS
    process.env.LANDBOT_HUMAN_AGENT_SALES_IDS = "111"
    process.env.LANDBOT_HUMAN_AGENT_SERVICE_IDS = "222"
    try {
      assert.equal(isAssignedToHumanAgent(333), false)
      assert.equal(
        shouldDeferToHumanAgent({ assignedAgentId: 333, humanAgentLastAt: null, lastUserAt: null }),
        false
      )
    } finally {
      process.env.LANDBOT_HUMAN_AGENT_SALES_IDS = prevSales
      process.env.LANDBOT_HUMAN_AGENT_SERVICE_IDS = prevService
    }
  })
})

describe("parseLandbotHookMessage", () => {
  it("parses customer messages with assigned agent id", () => {
    const parsed = parseLandbotHookMessage(
      {
        messages: [
          {
            type: "text",
            timestamp: 1,
            data: { body: "שלום" },
            sender: { id: 65462634, type: "customer" },
            customer: { id: 65462634, phone: "972547495083", agent_id: 40684 },
          },
        ],
      },
      null
    )
    assert.equal(parsed?.kind, "customer")
    if (parsed?.kind === "customer") {
      assert.equal(isCustomerChat(parsed), true)
      assert.equal(parsed.assignedAgentId, 40684)
    }
  })

  it("parses human agent messages", () => {
    const parsed = parseLandbotHookMessage(
      {
        messages: [
          {
            type: "text",
            timestamp: 2,
            data: { body: "היי, אני נציג" },
            sender: { id: 40684, name: "Pau", type: "agent" },
            customer: { id: 65462634 },
          },
        ],
      },
      null
    )
    assert.equal(isAgentChat(parsed!), true)
    if (parsed && isAgentChat(parsed)) {
      assert.equal(parsed.agentId, 40684)
    }
  })

  it("parses assign events", () => {
    const parsed = parseLandbotHookMessage(
      {
        messages: [
          {
            type: "event",
            action: "assign",
            agent_id: 40684,
            sender: { type: "sys", id: 0 },
            customer: { id: 65462634 },
          },
        ],
      },
      null
    )
    assert.equal(isLandbotEvent(parsed!), true)
    if (parsed && isLandbotEvent(parsed)) {
      assert.equal(parsed.action, "assign")
      assert.equal(parsed.agentId, 40684)
    }
  })
})
