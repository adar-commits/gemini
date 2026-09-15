import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { resolveCrmDepartmentForTurn } from "@/lib/crm/conversation-department"
import type { HistoryMessage } from "@/lib/agents/types"

describe("crm department early sales (532408613 — Astra smaller size)", () => {
  const historyBeforeHandoff: HistoryMessage[] = [
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
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה, לסלון\n\nכדי שהיועץ יוכל להתאים בול, אפשר לשתף מידות הסלון בערך או גודל הספה?",
    },
  ]

  it("resolves sales department before handoff from ongoing intake", () => {
    const resolved = resolveCrmDepartmentForTurn({
      history: historyBeforeHandoff,
      body: "הזפה 3 מ רוחב",
    })
    assert.deepEqual(resolved, { department: "sales", source: "structured" })
  })

  it("hints crm_department sales on ongoing intake thread", () => {
    const hints = buildConversationHints({
      body: "הזפה 3 מ רוחב",
      history: historyBeforeHandoff,
      phone: "0542082048",
    })
    assert.match(hints ?? "", /crm_department.*sales/i)
  })

  it("allows LLM flip to service after sales intake started", () => {
    const resolved = resolveCrmDepartmentForTurn({
      llmDepartment: "service",
      history: historyBeforeHandoff,
      body: "בעצם קיבלתי את השטיח ויש פגם",
    })
    assert.deepEqual(resolved, { department: "service", source: "llm" })
  })
})
