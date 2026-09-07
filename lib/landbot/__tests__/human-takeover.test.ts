import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isAssignedToHumanAgent,
  isConfiguredHumanAgentId,
  isLandbotApiAgent,
  isLiveHumanLandbotAgent,
  shouldDeferToHumanAgent,
  shouldRecordHumanAgentActivity,
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

  it("does not defer when assigned to builtin HoM API agent 279136", () => {
    assert.equal(isAssignedToHumanAgent(279136), false)
    assert.equal(
      shouldDeferToHumanAgent({ assignedAgentId: 279136, humanAgentLastAt: null, lastUserAt: null }),
      false
    )
  })

  it("defers on non-API assignment when builtin API agent ids exist", () => {
    const prevSales = process.env.LANDBOT_HUMAN_AGENT_SALES_IDS
    const prevService = process.env.LANDBOT_HUMAN_AGENT_SERVICE_IDS
    process.env.LANDBOT_HUMAN_AGENT_SALES_IDS = "111"
    process.env.LANDBOT_HUMAN_AGENT_SERVICE_IDS = "222"
    try {
      assert.equal(isAssignedToHumanAgent(333), true)
      assert.equal(
        shouldDeferToHumanAgent({ assignedAgentId: 333, humanAgentLastAt: null, lastUserAt: null }),
        true
      )
    } finally {
      process.env.LANDBOT_HUMAN_AGENT_SALES_IDS = prevSales
      process.env.LANDBOT_HUMAN_AGENT_SERVICE_IDS = prevService
    }
  })
})

describe("live human agent detection", () => {
  it("records activity for any named human rep, not only configured ids", () => {
    assert.equal(
      shouldRecordHumanAgentActivity({
        agentId: 51234,
        agentName: "Noa Babajani",
      }),
      true
    )
    assert.equal(isLiveHumanLandbotAgent({ agentId: 51234, agentName: "Noa Babajani" }), true)
  })

  it("ignores API automation outbound", () => {
    assert.equal(
      shouldRecordHumanAgentActivity({
        agentId: 99999,
        agentName: "API",
      }),
      false
    )
    assert.equal(isLandbotApiAgent({ agentId: 99999, agentName: "API" }), true)
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
      assert.equal(parsed.agentName, "Pau")
      assert.equal(shouldRecordHumanAgentActivity(parsed), true)
    }
  })

  it("does not treat API bot outbound as a live human rep", () => {
    const parsed = parseLandbotHookMessage(
      {
        messages: [
          {
            type: "text",
            timestamp: 3,
            data: { body: "*הום בוט :)*\nהשיחה אופסה." },
            sender: { id: 99999, name: "API", type: "agent" },
            customer: { id: 65462634 },
          },
        ],
      },
      null
    )
    assert.equal(isAgentChat(parsed!), true)
    if (parsed && isAgentChat(parsed)) {
      assert.equal(shouldRecordHumanAgentActivity(parsed), false)
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

  it("assign to configured human rep should defer bot", () => {
    const prevSales = process.env.LANDBOT_HUMAN_AGENT_SALES_IDS
    process.env.LANDBOT_HUMAN_AGENT_SALES_IDS = "40684"
    try {
      assert.equal(isAssignedToHumanAgent(40684), true)
    } finally {
      process.env.LANDBOT_HUMAN_AGENT_SALES_IDS = prevSales
    }
  })

  it("assign to API bot agent must not count as live human rep", () => {
    const prevApi = process.env.LANDBOT_API_AGENT_IDS
    delete process.env.LANDBOT_API_AGENT_IDS
    try {
      assert.equal(isAssignedToHumanAgent(279136), false)
      assert.equal(isLiveHumanLandbotAgent({ agentId: 279136 }), false)
      assert.equal(isLandbotApiAgent({ agentId: 279136 }), true)
    } finally {
      process.env.LANDBOT_API_AGENT_IDS = prevApi
    }
  })

  it("builtin API agent 279136 is recognized without env", () => {
    const prevApi = process.env.LANDBOT_API_AGENT_IDS
    delete process.env.LANDBOT_API_AGENT_IDS
    try {
      assert.equal(isLandbotApiAgent({ agentId: 279136 }), true)
      assert.equal(shouldRecordHumanAgentActivity({ agentId: 279136, agentName: "HoM Bot" }), false)
      assert.equal(isAssignedToHumanAgent(279136), false)
    } finally {
      process.env.LANDBOT_API_AGENT_IDS = prevApi
    }
  })

  it("non-API assign id defers once builtin API agent is known", () => {
    assert.equal(isAssignedToHumanAgent(51234), true)
    assert.equal(
      shouldDeferToHumanAgent({
        assignedAgentId: 51234,
        humanAgentLastAt: null,
        lastUserAt: null,
      }),
      true
    )
  })
})
