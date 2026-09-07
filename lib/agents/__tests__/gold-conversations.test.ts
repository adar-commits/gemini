import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import {
  isPurchaseCompletionStatement,
  isReturnEligibilityQuestion,
} from "@/lib/agents/inquiry-intent"
import { isDigitalDocumentRequest } from "@/lib/agents/digital-document-flow"
import { isInventoryQuestion } from "@/lib/agents/inventory-lookup"
import { isCasualGreeting, isCasualSmallTalk } from "@/lib/agents/greeting"
import { isHumanHandoffAffirmation } from "@/lib/agents/off-topic"
import { requiresOrderIdentification } from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"

type GoldCase = {
  id: string
  actual: boolean
  expected: boolean
}

describe("gold conversations must-pass set", () => {
  it("keeps routing and intent classification stable across real Hebrew examples", () => {
    const eligibilityHistory: HistoryMessage[] = [
      { role: "user", content: "השטיח הגיע היום ואני לא בבית עד מוצש" },
    ]

    const cases: GoldCase[] = [
      // greeting / opener
      { id: "greet_1", actual: isCasualGreeting("היי"), expected: true },
      { id: "greet_2", actual: isCasualGreeting("היי אשמח לקבל מענה"), expected: false },
      { id: "smalltalk_1", actual: isCasualSmallTalk("??"), expected: false },
      { id: "smalltalk_2", actual: isCasualSmallTalk("הלו"), expected: true },

      // shipping status
      { id: "ship_1", actual: isShippingStatusQuestion("איפה ההזמנה שלי"), expected: true },
      { id: "ship_2", actual: isShippingStatusQuestion("מתי המשלוח מגיע"), expected: false },
      { id: "ship_3", actual: isShippingStatusQuestion("עבר שבוע ולא הגיע אלי"), expected: false },
      { id: "ship_4", actual: isShippingStatusQuestion("מה שעות פתיחה ראשון לציון"), expected: false },

      // purchase completion statements (must not trigger lookup)
      {
        id: "purchase_done_1",
        actual: isPurchaseCompletionStatement("עשיתי את ההזמנה דרך הנציג"),
        expected: true,
      },
      {
        id: "purchase_done_2",
        actual: isPurchaseCompletionStatement("כבר הזמנתי אצלכם תודה"),
        expected: true,
      },
      {
        id: "purchase_done_3",
        actual: isPurchaseCompletionStatement("הזמנתי, מתי זה מגיע?"),
        expected: false,
      },

      // return eligibility FAQ (must stay FAQ)
      {
        id: "eligibility_1",
        actual: isReturnEligibilityQuestion(
          "אם לא ימצא חן בעיני אפשר להחזיר ביום ראשון?",
          eligibilityHistory
        ),
        expected: true,
      },
      {
        id: "eligibility_2",
        actual: isReturnEligibilityQuestion("איך פותחים בקשת החזרה?", []),
        expected: true,
      },

      // document requests
      {
        id: "doc_1",
        actual: isDigitalDocumentRequest("אפשר לשלוח לי קבלה בבקשה"),
        expected: true,
      },
      {
        id: "doc_2",
        actual: isDigitalDocumentRequest("צריכה חשבונית מס קבלה להזמנה"),
        expected: true,
      },
      { id: "doc_3", actual: isDigitalDocumentRequest("היי מה נשמע"), expected: false },

      // inventory requests
      {
        id: "inv_1",
        actual: isInventoryQuestion("יש מלאי למקט 31503138-200290 בנתניה?"),
        expected: true,
      },
      { id: "inv_2", actual: isInventoryQuestion("יש לכם שטיחי צמר?"), expected: false },
      { id: "inv_3", actual: isInventoryQuestion("אני מחפש פוף גדול"), expected: false },

      // handoff slang
      { id: "handoff_1", actual: isHumanHandoffAffirmation("תעביר"), expected: true },
      {
        id: "handoff_2",
        actual: isHumanHandoffAffirmation("תעביר ליועץ מכירות"),
        expected: true,
      },
      { id: "handoff_3", actual: isHumanHandoffAffirmation("תודה רבה"), expected: false },

      // requiresOrderIdentification hard boundaries
      {
        id: "req_lookup_1",
        actual: requiresOrderIdentification("איפה המשלוח שלי", []),
        expected: true,
      },
      {
        id: "req_lookup_2",
        actual: requiresOrderIdentification("אפשר לשלוח קבלה?", []),
        expected: true,
      },
      {
        id: "req_lookup_3",
        actual: requiresOrderIdentification("היי אשמח לקבל מענה", []),
        expected: false,
      },
      {
        id: "req_lookup_4",
        actual: requiresOrderIdentification("אם לא ימצא חן אפשר להחזיר בראשון?", eligibilityHistory),
        expected: false,
      },
      {
        id: "req_lookup_5",
        actual: requiresOrderIdentification("אני מחכה כבר שבועיים לאיסוף החזרה", []),
        expected: true,
      },

      // extra real phrasing coverage
      { id: "ship_5", actual: isShippingStatusQuestion("לא דיברו איתי על אספקה"), expected: false },
      { id: "ship_6", actual: isShippingStatusQuestion("יש צפי להגעה?"), expected: false },
      { id: "doc_4", actual: isDigitalDocumentRequest("אפשר העתק חשבונית?"), expected: true },
      { id: "doc_5", actual: isDigitalDocumentRequest("קבלה"), expected: true },
      { id: "greet_3", actual: isCasualGreeting("היי שלום"), expected: true },
      { id: "smalltalk_3", actual: isCasualSmallTalk("?"), expected: false },
      { id: "inv_4", actual: isInventoryQuestion("יש במלאי בסניף חיפה"), expected: true },
      { id: "inv_5", actual: isInventoryQuestion("יש לכם מבצעים"), expected: false },
      {
        id: "purchase_done_4",
        actual: isPurchaseCompletionStatement("עשיתי הזמנה אבל טרם קיבלתי"),
        expected: false,
      },
      {
        id: "handoff_4",
        actual: isHumanHandoffAffirmation("כן תעביר לנציג"),
        expected: true,
      },
      {
        id: "req_lookup_6",
        actual: requiresOrderIdentification("מספר הזמנה 76342", []),
        expected: true,
      },
    ]

    for (const testCase of cases) {
      assert.equal(
        testCase.actual,
        testCase.expected,
        `gold case failed: ${testCase.id}`
      )
    }
    assert.equal(cases.length >= 30, true)
  })
})
