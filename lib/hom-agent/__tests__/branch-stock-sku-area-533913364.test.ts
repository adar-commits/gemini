import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  hasStructuredPendingStateBinding,
  shouldDeferStructuredPreTurnToLlm,
} from "@/lib/hom-agent/opening-turn-llm"

/** 533913364 — SKU sent then area-only follow-up; must run inventory lookup, not re-ask SKU. */
describe("branch stock sku then area 533913364", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי אשמח לפרטים נוספים לגבי שטיח אושק antique wash ורוד-צבעוני 359*237 USHAK איפה אני יכולה לראות אותו?",
      agent: null,
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי! שטיח אושק antique wash יפהפה כדי לבדוק באיזה סניף יש אותו במלאi, אפשר לשלוח לי את המק״ט מעמוד המוצר באתר (לדוגמה: 31503138-200290)? כדאי לכתוב גם באיזה אזור נוח לך להגיע.",
      agent: "faq",
    },
    { role: "user", content: "מק״ט: 12138575-237359", agent: null },
    { role: "user", content: "חיפה", agent: null },
  ]

  const areaTurn = { text: "תל אביב/ ראשון", media: [] as [] }

  it("binds area follow-up to inventory pre-turn when SKU already in thread", () => {
    assert.equal(
      hasStructuredPendingStateBinding(history, areaTurn, areaTurn.text),
      true
    )
    assert.equal(shouldDeferStructuredPreTurnToLlm(history, areaTurn), false)
  })

  it("hints lookup_inventory without re-asking for SKU", () => {
    const hints = buildConversationHints({
      history,
      body: areaTurn.text,
      whatsappPhone: "+972500000000",
    })
    assert.match(hints, /INVENTORY SKU PROVIDED/)
    assert.match(hints, /lookup_inventory/)
    assert.match(hints, /Never re-ask for מק״ט/)
  })
})
