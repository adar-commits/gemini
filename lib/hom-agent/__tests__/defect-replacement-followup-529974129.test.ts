import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isDigitalDocumentRequest,
  isActiveDigitalDocumentFlow,
  shouldDeferDocumentFlowToOrderLookup,
} from "@/lib/agents/digital-document-flow"
import {
  classifyPostPurchaseCase,
  isCallbackUrgencyRequest,
  isDefectReplacementStatusQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  isOrderReferencePresentation,
  isOrderNumberRequestPending,
} from "@/lib/agents/order-lookup"
import {
  isPostPurchaseAlternateSizeAvailabilityQuestion,
  isPostPurchaseAlternateSizeThread,
} from "@/lib/agents/post-purchase-alt-size"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  runStructuredDocumentPreTurn,
  runStructuredPostPurchaseAltSizePreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 529974129 / תומר רוזנבאום — defect replacement follow-up misrouted to sales + document flow. */
describe("defect replacement follow-up (529974129)", () => {
  const defectThreadHistory: HistoryMessage[] = [
    {
      role: "user",
      content:
        "שלום\nפתחנו את השטיח, השטיח פגום בצד\nבצד אחד אין פרנז'ים\nתצקשרו אליי בדחיפות בבקשה",
    },
    {
      role: "assistant",
      content:
        "היי תומר, כאן רוני, פונה אליך בעקבות התלונה בשטיח פגום.\nשלח/י לי הודעה חוזרת ונוכל להמשיך את הטיפול מכאן.",
    },
    {
      role: "user",
      content:
        "השטיח הגיע ללא פרנג'ים בצד אחד, וכתמי שמן בגב השטיח\nהוא לא חזר אליי עדיין",
    },
    {
      role: "assistant",
      content:
        "אני רואה את השטיח וזה בהחלט לא תקין.\nאני מקים הזמנת החלפה ואני מבקש שיעשו ביקורת לשטיח החדש לפני שישלח אליך.",
    },
    {
      role: "user",
      content: "תודה רבה - אשמח שההחלפה תעשה בהקדם האפשרי",
    },
    {
      role: "user",
      content: "בוקר טוב\nאני מבקשת לדעת מתי עושים את ההחלפה של השטיח\nתודה",
    },
    {
      role: "assistant",
      content:
        "שלום תומר רוזנבאום 👋,\nתודה על רכישתך בשטיח האדום, להלן קישור לחשבונית מס הדיגיטלית שלך:\nhttps://documents.carpetshop.co.il/documents/b83b8abc-96a5-48d5-88f6-603523b016f0",
    },
  ]

  const replacementTimingAsk =
    "לא קיבלתי תשובה - למתי מתואמת ההחלפה של השטיח הפגים?"

  it("classifies replacement timing on defective carpet as defect service, not exchange", () => {
    assert.equal(classifyPostPurchaseCase(replacementTimingAsk), "defect")
    assert.equal(
      isDefectReplacementStatusQuestion(replacementTimingAsk, defectThreadHistory),
      true
    )
  })

  it("does not route defect replacement timing to post-purchase alt size pre-turn", () => {
    assert.equal(
      isPostPurchaseAlternateSizeAvailabilityQuestion(
        replacementTimingAsk,
        defectThreadHistory
      ),
      false
    )
    assert.equal(
      isPostPurchaseAlternateSizeThread(defectThreadHistory, replacementTimingAsk),
      false
    )

    const preTurn = runStructuredPostPurchaseAltSizePreTurn({
      turn: { text: replacementTimingAsk, media: [] },
      history: defectThreadHistory,
    })
    assert.equal(preTurn.kind, "skip")
  })

  it("detects callback urgency after replacement ask", () => {
    assert.equal(
      isCallbackUrgencyRequest("תתקשרו אליי - ד ח ו ף !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"),
      true
    )
  })

  it("treats labeled IN number as order reference, not document copy", () => {
    assert.equal(isOrderReferencePresentation("חשבונית IN264020038"), true)
    assert.equal(isDigitalDocumentRequest("חשבונית IN264020038"), false)
  })

  it("defers document flow when bot asked for order number and customer sent IN ref", async () => {
    const historyAfterOrderAsk: HistoryMessage[] = [
      ...defectThreadHistory,
      { role: "user", content: replacementTimingAsk },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמבין שזה דחוף ומתסכל להמתין בלי מענה\nכדי שנציג יוכל לבדוק מולכם את מועד ההחלפה של השטיח הפגום ולחזור אליכם בהקדם — יש לכם מספר הזמנה?",
      },
    ]

    assert.equal(isOrderNumberRequestPending(historyAfterOrderAsk), true)
    assert.equal(
      shouldDeferDocumentFlowToOrderLookup(historyAfterOrderAsk, "חשבונית IN264020038"),
      true
    )
    assert.equal(
      isActiveDigitalDocumentFlow(historyAfterOrderAsk, "חשבונית IN264020038"),
      false
    )

    const docPreTurn = await runStructuredDocumentPreTurn({
      turn: { text: "חשבונית IN264020038", media: [] },
      history: historyAfterOrderAsk,
      phone: "+972524289111",
    })
    assert.equal(docPreTurn.kind, "skip")
  })

  it("adds defect replacement and order-reference hints", () => {
    const hints = buildConversationHints({
      history: defectThreadHistory,
      body: replacementTimingAsk,
      whatsappPhone: "+972524289111",
    })

    assert.ok(hints)
    assert.match(hints, /DEFECT REPLACEMENT STATUS/i)

    const orderHints = buildConversationHints({
      history: [
        ...defectThreadHistory,
        { role: "user", content: replacementTimingAsk },
        {
          role: "assistant",
          content: "יש לכם מספר הזמנה? (למשל SO26005938)",
        },
      ],
      body: "חשבונית IN264020038",
      whatsappPhone: "+972524289111",
    })

    assert.ok(orderHints)
    assert.match(orderHints, /ORDER ID BINDING/i)
  })
})
