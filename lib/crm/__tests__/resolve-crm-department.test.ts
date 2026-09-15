import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  crmDepartmentSlugToLabel,
  resolveCrmDepartmentForTurn,
} from "@/lib/crm/conversation-department"
import type { HistoryMessage } from "@/lib/agents/types"

describe("resolveCrmDepartmentForTurn", () => {
  const salesIntakeHistory: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי אשמח לפרטים נוספים לגבי שטיח אסטרה 03 קרם/בז' ASTRA\nיש יותר קטן?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי! שמח שהתעניינתם בשטיח אסטרה 03…\n\nלאיזה חלל מיועד השטיח?",
    },
    { role: "user", content: "לסלון" },
  ]

  const serviceOrderFlowHistory: HistoryMessage[] = [
    { role: "user", content: "קיבלתי שטיח ויש פגם בקצה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמבין את החשש. יש מספר הזמנה? (למשל SO26005938)",
    },
  ]

  it("maps slugs to CRM Hebrew labels", () => {
    assert.equal(crmDepartmentSlugToLabel("sales"), "מכירות")
    assert.equal(crmDepartmentSlugToLabel("service"), "שירות לקוחות")
  })

  it("prefers LLM department over structured sales intake", () => {
    const resolved = resolveCrmDepartmentForTurn({
      llmDepartment: "service",
      history: salesIntakeHistory,
      body: "יש פגם בשטיח שקיבלתי",
    })
    assert.deepEqual(resolved, { department: "service", source: "llm" })
  })

  it("falls back to structured sales when LLM omits field", () => {
    const resolved = resolveCrmDepartmentForTurn({
      history: salesIntakeHistory,
      body: "לסלון",
    })
    assert.deepEqual(resolved, { department: "sales", source: "structured" })
  })

  it("falls back to structured service on active service order flow", () => {
    const resolved = resolveCrmDepartmentForTurn({
      history: serviceOrderFlowHistory,
      body: "SO26005938",
    })
    assert.deepEqual(resolved, { department: "service", source: "structured" })
  })

  it("returns null on ambiguous greeting", () => {
    const resolved = resolveCrmDepartmentForTurn({
      history: [],
      body: "היי",
    })
    assert.equal(resolved, null)
  })
})
