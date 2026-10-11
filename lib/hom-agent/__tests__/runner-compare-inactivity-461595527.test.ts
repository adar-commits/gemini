import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasOpenSalesIntakeQuestion,
  shouldSilentAutoAssignOnQuietWindow,
} from "@/lib/agents/inactivity-policy"
import { isAwaitingSalesIntakeAnswer } from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"

/** 461595527 — second catalog link + open runner room question; ~60s silence must not silent-handoff. */
describe("runner compare catalog inactivity 461595527", () => {
  const historyAfterSecondLink: HistoryMessage[] = [
    {
      role: "user",
      content:
        "https://www.carpetshop.co.il/products/garda-02-beige-runner?variant=42964321665215",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי נועה! ראיתי שהתעניינת בשטיח הראנר גרדה 02 בצבע בז'. לאיזה חלל הוא מיועד? למשל מסדרון, מטבח או ליד המיטה?",
      agent: "faq",
    },
    {
      role: "user",
      content:
        "https://www.carpetshop.co.il/products/niva-01-cream-beige-runner?_pos=46",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קיבלתי, אז יש לנו שתי אפשרויות על השולחן: גרדה 02 בז' וניבה 01 קרם בז' כדי שיועץ המכירות יוכל לעזור לך לבחור ביניהן, לאן הראנר מיועד? מסדרון, מטבח, ליד המיטה או מקום אחר?",
      agent: "faq",
    },
  ]

  it("treats לאן הראנר as open space intake", () => {
    assert.equal(isAwaitingSalesIntakeAnswer(historyAfterSecondLink), true)
  })

  it("blocks silent auto-assign until customer answers room", () => {
    assert.equal(hasOpenSalesIntakeQuestion(historyAfterSecondLink, "faq"), true)
    assert.equal(
      shouldSilentAutoAssignOnQuietWindow(historyAfterSecondLink, "faq"),
      false
    )
  })
})
