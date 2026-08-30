import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeTurns, summarizeTurn } from "@/lib/agents/user-turn"
import { buildSalesIntakeReply } from "@/lib/agents/sales-intake"

describe("mergeTurns", () => {
  it("joins rapid customer messages into one analysis body", () => {
    const merged = mergeTurns([
      { text: "אני מחפש שטיח לסלון", media: [] },
      { text: "מה האפשרויות", media: [] },
      { text: "מה יש לכם ב-900 שקל", media: [] },
    ])

    assert.match(summarizeTurn(merged), /שטיח לסלון/)
    assert.match(summarizeTurn(merged), /900/)
    assert.equal(merged.text.split("\n").length, 3)
  })
})

describe("buildSalesIntakeReply — merged burst", () => {
  it("recognizes product and space from a multi-line first turn", () => {
    const body = [
      "אני מחפש שטיח לסלון",
      "מה האפשרויות",
      "מה יש לכם ב-900 שקל",
    ].join("\n")

    const reply = buildSalesIntakeReply([], body)
    assert.doesNotMatch(reply, /באיזה מוצר/)
    assert.match(reply, /מידת הספה|גודל כללי של הסלון|תמונה/)
    assert.doesNotMatch(reply, /אוקיי הבנתי, אוקיי/)
  })
})
