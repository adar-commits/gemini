import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isCatalogProductInquiry, isProductDetailsRequest } from "@/lib/agents/product-handoff"
import {
  hasOngoingSalesIntake,
  isAwaitingSalesIntakeAnswer,
  pendingSalesIntakeQuestionKind,
} from "@/lib/agents/sales-intake"
import { resolveCrmDepartmentForTurn } from "@/lib/crm/conversation-department"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const OPENING =
  "היי אשמח לפרטים נוספים לגבי שטיח עלמה 02 חום ALMA- מידה xl"

const historyBeforeSpaceAnswer: HistoryMessage[] = [
  { role: "user", content: OPENING },
  { role: "user", content: "מור ששון" },
  { role: "user", content: "2.00*2.90" },
  {
    role: "assistant",
    content:
      "*הום בוט :)* היי מור! בשמחה, נעזור עם עלמה 02 חום במידה XL ‏(2.00*2.90). כדי שיועץ המכירות יוכל לתת את כל הפרטים ולבדוק שהשטיח מתאים, לאיזה חדר הוא מיועד?",
  },
]

const historyAfterSpaceAnswer: HistoryMessage[] = [
  ...historyBeforeSpaceAnswer,
  { role: "user", content: "סלון" },
  {
    role: "assistant",
    content:
      "*הום בוט :)* מעולה, סלון. מה גודל הספה או המידות הכלליות של הסלון (למשל 4×5 מ׳)? זה יעזור ליועץ להבין את החלל.",
  },
]

/** 534348772 — Alma XL catalog inquiry: room/sofa intake wording must bind sales thread. */
describe("catalog product intake 534348772", () => {
  it("detects Landbot product-details opener as catalog sales", () => {
    assert.equal(isProductDetailsRequest(OPENING), true)
    assert.equal(isCatalogProductInquiry(OPENING, []), true)
  })

  it("binds לאיזה חדר room question to ongoing sales intake", () => {
    assert.equal(hasOngoingSalesIntake(historyBeforeSpaceAnswer), true)
    assert.equal(isAwaitingSalesIntakeAnswer(historyBeforeSpaceAnswer), true)
    assert.equal(pendingSalesIntakeQuestionKind(historyBeforeSpaceAnswer), "space")
  })

  it("binds גודל הספה follow-up to ongoing sales intake", () => {
    assert.equal(hasOngoingSalesIntake(historyAfterSpaceAnswer), true)
    assert.equal(isAwaitingSalesIntakeAnswer(historyAfterSpaceAnswer), true)
    assert.equal(pendingSalesIntakeQuestionKind(historyAfterSpaceAnswer), "sofa")
  })

  it("resolves CRM department sales on space answer turn", () => {
    const resolved = resolveCrmDepartmentForTurn({
      history: historyBeforeSpaceAnswer,
      body: "סלון",
    })
    assert.deepEqual(resolved, { department: "sales", source: "structured" })
  })

  it("hints sales thread and never human_service on catalog intake", () => {
    const hints = buildConversationHints({
      history: historyBeforeSpaceAnswer,
      body: "סלון",
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /CATALOG PRODUCT \(534348772/)
    assert.match(hints!, /SALES THREAD \(מכירות\)/)
    assert.match(hints!, /Never `human_service`/)
    assert.match(hints!, /SALES INTAKE QUIZ/)
  })
})
