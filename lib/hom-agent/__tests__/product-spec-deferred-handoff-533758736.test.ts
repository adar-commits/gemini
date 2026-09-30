import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasCatalogIntakeSizeAndRoom,
  isProductSpecDeferredToAdvisorInThread,
} from "@/lib/agents/product-handoff"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** 533758736 — DAMKA weight question; after size + room bot must hand off, not ask sofa size. */
const OPENING =
  "היי אשמח לפרטים נוספים לגבי שטיח דמקה קרם-בז' DAMKA שטיח דמקה קרם-בז' DAMKA\nמה משקל השטיח בדגם הזה"

describe("product spec deferred handoff 533758736", () => {
  const historyBeforeRoom: HistoryMessage[] = [
    { role: "user", content: OPENING },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי ריקי! המשקל של דמקה קרם-בז' תלוי במידה, ויועץ המכירות יבדוק לך את המשקל המדויק. באיזו מידה מדובר?",
    },
    { role: "user", content: "160/230" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מעולה, 160*230. את המשקל המדויק במידה הזו יועץ המכירות יבדוק לך. אין לי אותו כאן. בינתיים, לאיזה חדר השטיח מיועד?",
    },
  ]

  it("detects deferred spec and size+room from thread state", () => {
    assert.equal(isProductSpecDeferredToAdvisorInThread(historyBeforeRoom), true)
    assert.equal(hasCatalogIntakeSizeAndRoom(historyBeforeRoom, "לסלון"), true)
  })

  it("hints immediate human_sales on room answer — not sofa intake", () => {
    const hints = buildConversationHints({
      body: "לסלון",
      history: historyBeforeRoom,
      whatsappPhone: "+972547495083",
    })
    assert.match(hints ?? "", /PRODUCT SPEC DEFERRED/i)
    assert.match(hints ?? "", /action: human_sales.*same.*JSON now/i)
    assert.match(hints ?? "", /Do \*\*not\*\* ask sofa size/i)
  })

  it("does not hint early handoff before room is known", () => {
    const hints = buildConversationHints({
      body: "160/230",
      history: historyBeforeRoom.slice(0, 1),
      whatsappPhone: "+972547495083",
    })
    assert.doesNotMatch(hints ?? "", /PRODUCT SPEC DEFERRED/i)
  })
})
