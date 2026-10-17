import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldDeferInactivityForInventorySkuCollection } from "@/lib/agents/inactivity-policy"
import type { HistoryMessage } from "@/lib/agents/types"

/** 535244587 — branch stock ask + photos; bot asked for מק״ט; must not inactivity-handoff. */
describe("inactivity defer while collecting inventory SKU (535244587)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nהיי! 😊 במה אפשר לעזור?",
      agent: "faq",
    },
    {
      role: "user",
      content:
        "יש במלאי בסניף קריית אתא?\n[תמונה][media:image:https://example.com/a.jpg]",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבשמחה אבדוק את המלאי בסניף קריית אתא אפשר לכתוב לי את המק״ט של המוצר מהאתר (לדוגמה: 31503138-200290)? כל מידה מופיעה באתר עם מק״ט משלה.",
      agent: "faq",
    },
  ]

  it("defers inactivity ping/handoff until customer sends a SKU", () => {
    assert.equal(shouldDeferInactivityForInventorySkuCollection(history), true)
  })

  it("resumes inactivity after inventory lookup reply", () => {
    const afterLookup: HistoryMessage[] = [
      ...history,
      { role: "user", content: "31503138-200290" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי זמינות — *יש במלאי* בסניף קריית אתא (מק\"ט 31503138-200290).",
        agent: "faq",
      },
    ]
    assert.equal(shouldDeferInactivityForInventorySkuCollection(afterLookup), false)
  })
})
