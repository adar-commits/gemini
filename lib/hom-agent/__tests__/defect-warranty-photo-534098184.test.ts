import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import { isServicePhotoAnalysisContext } from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const OPENING =
  "שלום, קניתי שטיח ארוג והתגלו בו שני פגמים שאני רוצה לוודא שיכוסו באחריות במידה ויווצרו חורים בעקבותיהם"

const PHOTO_BODY =
  "חוט חתוך שהודבק בדבק\n[media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533847318/5NJGPNTOR14JWUZBHZBDXO73239B12WI.jpg]"

/** Replay 534098184 — defect/warranty thread; photo turn must not bind human_sales. */
describe("defect warranty photo (534098184)", () => {
  const historyAfterOpening: HistoryMessage[] = [
    { role: "user", content: OPENING },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nשלום אורן, אני לא יכול לאשר מראש כיסוי באחריות. נציג שירות יבדוק את המקרה ויחזור עם תשובה. כדי שיהיה לו את כל מה שצריך, אפשר לשלוח תמונה ברורה של כל אחד משני הפגמים? ואם יש מספר הזמנה (למשל #36805) גם אותו.",
    },
  ]

  it("classifies opening as defect service case", () => {
    assert.equal(classifyPostPurchaseCase(OPENING), "defect")
  })

  it("detects service photo context on defect follow-up photo", () => {
    assert.equal(isServicePhotoAnalysisContext(historyAfterOpening, PHOTO_BODY), true)
  })

  it("binds opening defect thread to service department", () => {
    const hints = buildConversationHints({ history: [], body: OPENING }) ?? ""
    assert.match(hints, /DEFECT \/ WARRANTY \(534098184\)/)
    assert.match(hints, /crm_department.*service/i)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
    assert.doesNotMatch(hints, /action: human_sales/)
  })

  it("does not emit generic PHOTO RECEIVED sales handoff on defect photo turn", () => {
    const hints =
      buildConversationHints({ history: historyAfterOpening, body: PHOTO_BODY }) ?? ""
    assert.match(hints, /SERVICE DEFECT PHOTO \(504655399 \/ 534098184\)/)
    assert.match(hints, /crm_department.*service/i)
    assert.match(hints, /SERVICE PHOTO VISION/)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
    assert.doesNotMatch(hints, /action: human_sales/)
  })
})
