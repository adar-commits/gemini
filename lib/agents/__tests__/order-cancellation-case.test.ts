import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import {
  extractServiceIntake,
  serviceIssueSummaryLabel,
} from "@/lib/agents/service-intake"

/** 533458767 — cancel before delivery must not be labeled בקשת החזרה in rep summary. */
describe("order cancellation vs return (533458767)", () => {
  it("classifies cancel wording as return_request at classifier layer", () => {
    assert.equal(classifyPostPurchaseCase("רוצה לבטל את ההזמנה"), "return_request")
  })

  it("still classifies post-receipt return as return_request", () => {
    assert.equal(
      classifyPostPurchaseCase("קיבלתי את השטיח ורוצה להחזיר"),
      "return_request"
    )
  })

  it("service summary uses ביטול הזמנה label for pre-delivery cancel", () => {
    const intake = extractServiceIntake([], "רוצה לבטל את ההזמנה")
    assert.equal(intake.issueKind, "return_request")
    assert.equal(
      serviceIssueSummaryLabel(intake, "רוצה לבטל את ההזמנה"),
      "ביטול הזמנה"
    )
    assert.equal(
      serviceIssueSummaryLabel(intake, "קיבלתי את השטיח ורוצה להחזיר"),
      "בקשת החזרה"
    )
  })
})
