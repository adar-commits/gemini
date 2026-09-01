import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isExtendedOpeningDebounce,
  isSessionResetCommand,
} from "@/lib/agents/greeting"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import type { HistoryMessage } from "@/lib/agents/types"

describe("isExtendedOpeningDebounce", () => {
  it("uses extended window on empty history", () => {
    assert.equal(
      isExtendedOpeningDebounce({ history: [], lastAction: null }),
      true
    )
  })

  it("uses extended window right after reset action", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "איפוס" },
      { role: "assistant", content: "השיחה אופסה. אפשר להתחיל מחדש." },
    ]
    assert.equal(
      isExtendedOpeningDebounce({ history, lastAction: "reset" }),
      true
    )
  })

  it("uses extended window when hello arrived but bot has not answered yet", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "איפוס" },
      { role: "assistant", content: "השיחה אופסה. אפשר להתחיל מחדש." },
      { role: "user", content: "היי שלום" },
    ]
    assert.equal(
      isExtendedOpeningDebounce({ history, lastAction: "reset" }),
      true
    )
  })

  it("drops to normal debounce after bot answered substantive user", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי שלום" },
      { role: "assistant", content: "היי! איך אפשר לעזור?" },
    ]
    assert.equal(
      isExtendedOpeningDebounce({ history, lastAction: "reply" }),
      false
    )
  })

  it("ignores reset command in user history counts", () => {
    assert.equal(isSessionResetCommand("איפוס"), true)
    assert.equal(isSessionResetCommand("היי"), false)
  })
})

describe("classifyPostPurchaseCase merged burst", () => {
  it("detects return pickup on second line after greeting", () => {
    const body = [
      "היי שלום",
      "אני ממתין גבר שבועיים שיאספו ממני שטיח שרציתי להחזיר",
    ].join("\n")
    assert.equal(classifyPostPurchaseCase(body), "return_pickup_pending")
  })
})
