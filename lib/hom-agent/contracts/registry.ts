import { buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import type { HistoryMessage } from "@/lib/agents/types"
import type { ConversationContract } from "@/lib/hom-agent/contracts/types"

const SHIPPING_THEN_DELIVERED: HistoryMessage[] = [
  { role: "user", content: "היי אשמח לדעת מתי מגיע המשלוח שלי ?" },
  {
    role: "assistant",
    content:
      "*הום בוט :)*\nקודם אמצא את ההזמנה… האם היא רשומה על המספר ממנו אני מתכתב כרגע?",
  },
  { role: "user", content: "כן" },
  {
    role: "assistant",
    content:
      "*הום בוט :)*\nבדקתי, איזה כיף! המשלוח הועמס לשליח…\n\nאפשר לעזור במשהו נוסף?",
  },
]

export const CONVERSATION_CONTRACTS: ConversationContract[] = [
  {
    id: "return-shipping-fee-507969015",
    description: "Return courier fee FAQ must not hand off",
    source: { phone: "0524247266", session: "507969015" },
    history: [
      {
        role: "user",
        content:
          "הזמנתי שטיח שעוד לא הגיע ואני רוצה לבטל.\nהוא לא יתאים לי במידות. עשיתי טעות",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני יומיים… (מס׳ הזמנה #76905) נכון?",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאם אין את המספר בהישג יד — אפשר גם להעביר את הפנייה לנציג… להעביר?",
      },
    ],
    turn: {
      text: "אני אשמח לדעת כמה יעלה לי אם קודם אקבל אותו הביתה ואז אתחרט. כמה דמי משלוח\nכן כן",
      phone: "0524247266",
    },
    assertions: [
      { type: "classifier", name: "isReturnShippingFeeQuestion", expect: true },
      { type: "classifier", name: "isReturnPolicyQuestion", expect: true },
      {
        type: "preTurn",
        handler: "kb_faq",
        expect: "handled",
        action: "reply",
        replyMustInclude: ["85"],
        replyMustNotInclude: ["אין נציגי שירות"],
      },
      {
        type: "coerce",
        inputAction: "human_service",
        expectAction: "reply",
      },
      {
        type: "hints",
        hintMustMatch: ["RETURN SHIPPING FEE FAQ", "NOT human_service"],
        hintMustNotMatch: ["HANDOFF OFFER PENDING", "AFTER-HOURS HANDOFF"],
      },
    ],
    snapshot: {
      action: "reply",
      replyMustInclude: ["85", "returns.carpetshop"],
      replyMustNotInclude: ["מעביר", "נציג"],
    },
  },
  {
    id: "rug-cleaning-tone-532160407",
    description: "Rug cleaning FAQ — warm tone, no handoff",
    source: { phone: "0542115321", session: "532160407" },
    history: [],
    turn: {
      text: "מבקשת לבדוק אם אתם מנקים שטיחים שאגי כולל נטרול ריח",
      phone: "0542115321",
    },
    assertions: [
      { type: "classifier", name: "isRugCleaningServiceQuestion", expect: true },
      {
        type: "preTurn",
        handler: "kb_faq",
        expect: "handled",
        action: "reply",
        replyMustNotInclude: ["אין לי מידע"],
      },
      {
        type: "hints",
        hintMustMatch: ["RUG CLEANING / CARE FAQ", "no proactive handoff"],
      },
    ],
    snapshot: {
      action: "reply",
      replyMustInclude: ["ניקוי"],
      replyMustNotInclude: ["אין לי מידע", "מעביר"],
    },
  },
  {
    id: "missing-item-document-release-532219451",
    description: "Missing item thread must not hijack document flow",
    source: { phone: "+972526052903", session: "532219451" },
    history: [],
    turn: {
      text: "היי\nביצעתי הזמנה של שני שטיחים וקיבלתי קבלה עבור שני שטיחים\nבפועל הגיע רק שטיח 1 וגם החשבונית מס הייתה רק על 1\nחסר שטיח",
      phone: "+972526052903",
    },
    assertions: [
      { type: "classifier", name: "classifyPostPurchaseCase_missing_item", expect: true },
      {
        type: "documentFlow",
        name: "shouldReleaseStructuredDocumentFlow",
        expect: true,
      },
      { type: "classifier", name: "isDigitalDocumentRequest", expect: false },
      { type: "preTurn", handler: "document", expect: "skip" },
      {
        type: "hints",
        hintMustMatch: ["MISSING ITEM"],
        hintMustNotMatch: ["DOCUMENT COPY \\(קבלה"],
      },
    ],
  },
  {
    id: "missing-item-history-release-532219451",
    description: "Document contamination releases after missing-item history",
    source: { phone: "+972526052903", session: "532219451" },
    history: [
      {
        role: "user",
        content:
          "היי\nביצעתי הזמנה של שני שטיחים…\nבפועל הגיע רק שטיח 1\nחסר שטיח",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהאם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (052-6052903)",
      },
    ],
    turn: { text: "כן", phone: "+972526052903" },
    assertions: [
      {
        type: "documentFlow",
        name: "shouldReleaseStructuredDocumentFlow",
        expect: true,
      },
      {
        type: "documentFlow",
        name: "shouldDeferDocumentFlowToOrderLookup",
        expect: true,
      },
      {
        type: "documentFlow",
        name: "isActiveDigitalDocumentFlow",
        expect: false,
      },
    ],
  },
  {
    id: "return-portal-no-handoff-530914111",
    description: "Return portal self-service — no proactive handoff",
    source: { phone: "0505205897", session: "530914111" },
    history: [
      { role: "user", content: "אני מבקשת להחזיר את השטיח לחנות." },
      { role: "assistant", content: buildDissatisfactionRescueReply("0505205897") },
      { role: "user", content: "צריכה הובלה" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nכדי לתאם את האיסוף, יש לפתוח בקשת החזרה בפורטל:\nhttps://returns.carpetshop.co.il/?phone=0505205897",
      },
    ],
    turn: { text: "אני מבקשת החזר כספי", phone: "0505205897" },
    assertions: [
      {
        type: "hints",
        hintMustMatch: ["RETURN PORTAL SELF-SERVICE", "no proactive handoff"],
        hintMustNotMatch: ["rep summary → human_service"],
      },
      { type: "coerce", inputAction: "human_service", expectAction: "reply" },
    ],
  },
  {
    id: "service-to-sales-pivot-531404146",
    description: "Mid-thread pivot service→sales after delivered status",
    source: { phone: "0509640100", session: "531404146" },
    history: [
      ...SHIPPING_THEN_DELIVERED,
      { role: "user", content: "תודה" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nבשמחה! במה עוד אוכל לעזור?",
      },
    ],
    turn: {
      text: "אשמח לקבל תמונה של שטיח לולאות בצבע אפור בהיר",
      phone: "0509640100",
    },
    assertions: [
      {
        type: "hints",
        hintMustMatch: ["MID-THREAD PIVOT \\(service→sales\\)", "crm_department.*sales"],
      },
      { type: "crm", department: "sales", source: "structured" },
    ],
  },
  {
    id: "service-to-sales-intake-531404146",
    description: "Sales CRM once intake question was sent",
    source: { phone: "0509640100", session: "531404146" },
    history: [
      ...SHIPPING_THEN_DELIVERED,
      { role: "user", content: "תודה" },
      { role: "assistant", content: "*הום בוט :)*\nבשמחה! 😊 במה עוד אוכל לעזור?" },
      { role: "user", content: "אשמח לקבל תמונה של שטיח לולאות בצבע אפור בהיר" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\n…אפשר לקשר ליועץ מכירות…\n\nלאיזה חלל בבית מיועד השטיח?",
      },
    ],
    turn: { text: "סלון", phone: "0509640100" },
    assertions: [{ type: "crm", department: "sales", source: "structured" }],
  },
  {
    id: "sales-to-service-flip-531404146",
    description: "LLM may flip back to service on delivery complaint",
    source: { phone: "0509640100", session: "531404146" },
    history: [
      ...SHIPPING_THEN_DELIVERED,
      { role: "user", content: "תודה" },
      { role: "assistant", content: "*הום בוט :)*\nבשמחה! 😊 במה עוד אוכל לעזור?" },
      { role: "user", content: "אשמח לקבל תמונה של שטיח לולאות בצבע אפור בהיר" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\n…\n\nלאיזה חלל בבית מיועד השטיח?",
      },
    ],
    turn: { text: "הי לא קיבלתי את המשלוח", phone: "0509640100" },
    assertions: [
      {
        type: "crm",
        department: "service",
        source: "llm",
        llmDepartment: "service",
      },
    ],
  },
  {
    id: "crm-department-early-sales-532408613",
    description: "Ongoing sales intake resolves CRM to sales",
    source: { phone: "0542082048", session: "532408613" },
    history: [
      {
        role: "user",
        content:
          "היי אשמח לפרטים נוספים לגבי שטיח אסטרה 03 קרם/בז' ASTRA\nיש יותר קטן?",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהיי! שמח שהתעניינתם בשטיח אסטרה 03…\n\nלאיזה חלל מיועד השטיח?",
      },
      { role: "user", content: "לסלון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמעולה, לסלון\n\nכדי שהיועץ יוכל להתאים בול, אפשר לשתף מידות הסלון בערך או גודל הספה?",
      },
    ],
    turn: { text: "הזפה 3 מ רוחב", phone: "0542082048" },
    assertions: [
      { type: "crm", department: "sales", source: "structured" },
      { type: "hints", hintMustMatch: ["crm_department.*sales"] },
    ],
  },
  {
    id: "exchange-intake-portal-path",
    description: "Dissatisfaction menu → return stays portal",
    source: { phone: "+972508713127" },
    history: [{ role: "assistant", content: buildDissatisfactionRescueReply("+972508713127") }],
    turn: { text: "רוצה להחזיר", phone: "+972508713127" },
    assertions: [
      {
        type: "preTurn",
        handler: "return_options",
        expect: "handled",
        action: "reply",
        replyMustInclude: ["returns.carpetshop"],
      },
    ],
  },
  {
    id: "exchange-intake-start",
    description: "Dissatisfaction menu → exchange starts intake",
    source: { phone: "+972508713127" },
    history: [{ role: "assistant", content: buildDissatisfactionRescueReply("+972508713127") }],
    turn: { text: "החלפה", phone: "+972508713127" },
    assertions: [
      {
        type: "preTurn",
        handler: "return_options",
        expect: "handled",
        action: "reply",
      },
    ],
  },
  {
    id: "refund-timeline-vs-return-location",
    description: "Refund timeline classifier distinct from return location",
    source: {},
    history: [],
    turn: { text: "מסרתי בסניף, מתי אקבל החזר" },
    assertions: [
      { type: "classifier", name: "isRefundTimelineQuestion", expect: true },
    ],
  },
  {
    id: "branch-review-link",
    description: "Branch review link request",
    source: {},
    history: [],
    turn: { text: "לינק לדירוג סניף סגולה" },
    assertions: [
      { type: "classifier", name: "isBranchReviewLinkRequest", expect: true },
    ],
  },
  {
    id: "branch-list-not-review",
    description: "Branch list is not review link",
    source: {},
    history: [],
    turn: { text: "איזה סניפים יש" },
    assertions: [
      { type: "classifier", name: "isBranchReviewLinkRequest", expect: false },
    ],
  },
  {
    id: "dissatisfaction-not-defect",
    description: "Dissatisfaction without defect",
    source: {},
    history: [],
    turn: { text: "לא ממש אוהב את השטיח" },
    assertions: [
      { type: "classifier", name: "classifyPostPurchaseCase_dissatisfaction", expect: true },
      { type: "classifier", name: "classifyPostPurchaseCase_defect", expect: false },
    ],
  },
  {
    id: "defect-not-dissatisfaction",
    description: "Defect is not dissatisfaction",
    source: {},
    history: [],
    turn: { text: "השטיח הגיע קרוע" },
    assertions: [
      { type: "classifier", name: "classifyPostPurchaseCase_defect", expect: true },
      {
        type: "classifier",
        name: "classifyPostPurchaseCase_dissatisfaction",
        expect: false,
      },
    ],
  },
  {
    id: "order-status-not-shipping-policy",
    description: "Order status vs generic shipping policy",
    source: {},
    history: [],
    turn: { text: "איפה ההזמנה שלי" },
    assertions: [
      { type: "classifier", name: "isShippingStatusQuestion", expect: true },
    ],
  },
  {
    id: "order-status-not-return-options-532163951",
    description: "Order status opening must not show dissatisfaction return menu",
    source: { session: "532163951" },
    history: [],
    turn: { text: "היי אשמח לדעת מתי מגיע המשלוח שלי ?", phone: "+972501234567" },
    assertions: [
      {
        type: "preTurn",
        handler: "return_options",
        expect: "skip",
      },
      {
        type: "preTurn",
        handler: "order",
        expect: "handled",
        action: "reply",
        replyMustNotInclude: ["יש שתי אפשרויות"],
      },
      {
        type: "classifier",
        name: "classifyPostPurchaseCase_return_pickup_pending",
        expect: false,
      },
    ],
  },
  {
    id: "shipping-policy-not-order-status",
    description: "Shipping cost policy is not order lookup",
    source: {},
    history: [],
    turn: { text: "כמה עולה משלוח" },
    assertions: [
      { type: "classifier", name: "isShippingStatusQuestion", expect: false },
    ],
  },
  {
    id: "return-policy-opening",
    description: "Return policy FAQ opening",
    source: {},
    history: [],
    turn: {
      text: "הזמנתי שטיח שעוד לא הגיע ואני רוצה לבטל.\nהוא לא יתאים לי במידות",
    },
    assertions: [
      { type: "classifier", name: "isReturnPolicyQuestion", expect: true },
      { type: "classifier", name: "classifyPostPurchaseCase_dissatisfaction", expect: true },
    ],
  },
  {
    id: "document-receipt-ref-not-copy-530989504",
    description: "Receipt reference on shipping thread is not document copy",
    source: { phone: "+972544981002", session: "530989504" },
    history: [
      {
        role: "user",
        content:
          "הי\nקניתי פופ לפני 10 ימים\nהיה אמור להגיע אליכם לסניף\nמה קורה עם זה?",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהיי, מבין שמדובר בפוף... אפשר לשלוח את מספר ההזמנה?",
      },
      { role: "user", content: "RC269019533" },
      { role: "user", content: "זה הקבלה" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאיזה סוג מסמך נדרש?\n1. חשבונית מס\n2. חשבונית מס קבלה\n3. קבלה",
      },
      {
        role: "user",
        content: "לא קיבלתי את המוצר ולא יצרו קשר\nאת המוצר",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהאם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (054-4981002)",
      },
    ],
    turn: { text: "כן", phone: "+972544981002" },
    assertions: [
      { type: "classifier", name: "isDigitalDocumentRequest", args: ["זה הקבלה"], expect: false },
      {
        type: "documentFlow",
        name: "shouldDeferDocumentFlowToOrderLookup",
        expect: true,
      },
      {
        type: "documentFlow",
        name: "isActiveDigitalDocumentFlow",
        expect: false,
      },
      { type: "preTurn", handler: "document", expect: "skip" },
      {
        type: "preTurn",
        handler: "order",
        expect: "handled",
        replyMustNotInclude: ["לא הבנתי"],
      },
    ],
  },
  {
    id: "order-lookup-phone-confirm-531770091",
    description: "Phone confirm binds to order lookup not document",
    source: { phone: "+972504440304", session: "531770091" },
    history: [
      { role: "user", content: "אשמח לדבר עם מישהו לגביי האספקה בבקשה 🙏🏻" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבשמחה אעזור בנושא האספקה\n\nכדי שאדע לבדוק בדיוק את הסטטוס, אתם מתכוונים להזמנה SO26022089?",
      },
      {
        role: "user",
        content: "עשיתי הזמנה \nואני רוצה להבין מה תאריך האספקה המשוער",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nברור…\n\nיש לכם מספר הזמנה? אם לא, אפשר לבדוק לפי מספר הטלפון.",
      },
      { role: "user", content: "IN264019998\nזה החשבונית" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאיזה סוג חשבונית נדרש?\n1. חשבונית מס\n2. חשבונית מס קבלה",
      },
      { role: "user", content: "הזמנה #76705" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהאם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (050-4440304)",
      },
    ],
    turn: { text: "כן", phone: "+972504440304" },
    assertions: [
      {
        type: "documentFlow",
        name: "isActiveDigitalDocumentFlow",
        expect: false,
      },
      { type: "preTurn", handler: "document", expect: "skip" },
      {
        type: "preTurn",
        handler: "order",
        expect: "handled",
        replyMustNotInclude: ["לא הבנתי"],
      },
    ],
  },
  {
    id: "kb-faq-coerce-after-hours",
    description: "KB FAQ coerces mistaken after-hours handoff action",
    source: { phone: "0524247266", session: "507969015" },
    history: [
      {
        role: "assistant",
        content: "*הום בוט :)*\nהאם להעביר את הפנייה לנציג… להעביר?",
      },
    ],
    turn: {
      text: "כמה יעלה לי אם קודם אקבל אותו הביתה ואז אתחרט. כמה דמי משלוח",
      phone: "0524247266",
    },
    assertions: [
      { type: "coerce", inputAction: "human_service", expectAction: "reply" },
      {
        type: "preTurn",
        handler: "kb_faq",
        expect: "handled",
        action: "reply",
        replyMustInclude: ["85"],
      },
    ],
  },
  {
    id: "sales-intake-skip-stale-ken-531404146",
    description: "Bare כן must not bind to stale sales quiz during service lookup",
    source: { phone: "0509640100", session: "531404146" },
    history: [
      ...SHIPPING_THEN_DELIVERED,
      { role: "user", content: "תודה" },
      { role: "assistant", content: "*הום בוט :)*\nבשמחה! 😊 במה עוד אוכל לעזור?" },
      { role: "user", content: "אשמח לקבל תמונה של שטיח לולאות בצבע אפור בהיר" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\n…\n\nלאיזה חלל בבית מיועד השטיח?",
      },
      { role: "user", content: "הי לא קיבלתי את המשלוח" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nקודם אמצא את ההזמנה… האם היא רשומה על המספר ממנו אני מתכתב כרגע?",
      },
    ],
    turn: { text: "כן", phone: "0509640100" },
    assertions: [{ type: "preTurn", handler: "sales_intake", expect: "skip" }],
  },
  {
    id: "return-eligibility-faq",
    description: "Return eligibility stays FAQ not order lookup",
    source: {},
    history: [
      { role: "user", content: "השטיח הגיע היום ואני לא בבית עד מוצש" },
    ],
    turn: { text: "אם לא ימצא חן בעיני אפשר להחזיר ביום ראשון?" },
    assertions: [
      {
        type: "classifier",
        name: "isReturnExchangePolicyFaqQuestion",
        expect: true,
      },
    ],
  },
  {
    id: "portal-thread-coerce-refund",
    description: "Portal thread refund ask coerces handoff",
    source: { phone: "0505205897", session: "530914111" },
    history: [
      { role: "user", content: "אני מבקשת להחזיר את השטיח לחנות." },
      { role: "assistant", content: buildDissatisfactionRescueReply("0505205897") },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nhttps://returns.carpetshop.co.il/?phone=0505205897",
      },
    ],
    turn: { text: "לא מעוניינת בשטיח בכלל", phone: "0505205897" },
    assertions: [
      { type: "coerce", inputAction: "human_service", expectAction: "reply" },
      {
        type: "hints",
        hintMustMatch: ["acknowledgment, not handoff"],
      },
    ],
  },
  {
    id: "order-change-unknown-status-532440340",
    description: "Order modification opener routes to lookup (unknown status handoff in delivery-status unit tests)",
    source: { phone: "0528484703", session: "532440340" },
    history: [],
    turn: { text: "שינוי הזמנה", phone: "+972528484703" },
    assertions: [
      { type: "classifier", name: "isOrderModificationRequest", args: ["שינוי הזמנה"], expect: true },
      {
        type: "hints",
        hintMustMatch: ["ORDER MODIFICATION"],
      },
    ],
  },
  {
    id: "order-change-waiting-for-rep-532440340",
    description: "Waiting for rep after transfer promise must not inactivity-ack",
    source: { phone: "0528484703", session: "532440340" },
    history: [
      { role: "user", content: "שינוי הזמנה" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, ההזמנה נמצאה, אך לא ניתן להציג כרגע סטטוס משלוח חד-משמעי. הפנייה תועבר להמשך טיפול.",
      },
      { role: "assistant", content: "*הום בוט :)*\nAsaf, עדיין כאן?" },
    ],
    turn: { text: "כן, אני מחכה לנציג שלכם", phone: "+972528484703" },
    assertions: [
      {
        type: "preTurn",
        handler: "guards",
        expect: "handled",
        action: "human_service",
        replyMustNotInclude: ["איך אוכל להמשיך לעזור"],
      },
    ],
  },
  {
    id: "order-change-no-relookup-532440340",
    description: "Exchange/cancel after order found must not restart phone lookup",
    source: { phone: "0528484703", session: "532440340" },
    history: [
      { role: "user", content: "שינוי הזמנה" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nקודם אמצא את ההזמנה… (052-8484703)",
      },
      { role: "user", content: "כן" },
      {
        role: "assistant",
        content: "*הום בוט :)*\n… (מס׳ הזמנה #76996) נכון?",
      },
      { role: "user", content: "כן" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, ההזמנה נמצאה, אך לא ניתן להציג כרגע סטטוס משלוח חד-משמעי. הפנייה תועבר להמשך טיפול.",
      },
    ],
    turn: {
      text: "אני רוצה להחליף את המוצר עם מוצר אחר\nאו לבטל ולהזמין מחדש\nמה נהיה?",
      phone: "+972528484703",
    },
    assertions: [
      {
        type: "preTurn",
        handler: "post_order_exchange",
        expect: "handled",
        action: "reply",
        replyMustInclude: ["נמשיך עם החלפה"],
      },
      { type: "preTurn", handler: "order", expect: "skip" },
    ],
  },
  {
    id: "order-cancel-menu-no-relookup-531159495",
    description: "Return menu 2 after order found must not restart lookup",
    source: { phone: "+972525991700", session: "531159495" },
    history: [
      { role: "user", content: "ביטול עסקה" },
      { role: "user", content: "נציג שירות" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nקודם אמצא… (052-5991700)",
      },
      { role: "user", content: "כן" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\n… (מס׳ הזמנה SO26021506) נכון?",
      },
      { role: "user", content: "נכון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, המשלוח סומן כנמסר…\n\nאפשר לעזור במשהו נוסף?",
      },
      { role: "user", content: "ביטול עסקה" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nניתן להחזיר…\n1. החזרה לסניפי הרשת — ללא עלות\n2. איסוף מהבית באמצעות שליח — בתשלום\n\n… returns.carpetshop.co.il …",
      },
    ],
    turn: { text: "2", phone: "+972525991700" },
    assertions: [
      {
        type: "preTurn",
        handler: "post_order_completed",
        expect: "handled",
        action: "reply",
        replyMustInclude: ["returns.carpetshop.co.il"],
        replyMustNotInclude: ["קודם אמצא", "האם היא רשומה על המספר"],
      },
      { type: "preTurn", handler: "order", expect: "skip" },
    ],
  },
  {
    id: "order-cancel-rep-no-relookup-531159495",
    description: "Rep request after order found must hand off not re-lookup",
    source: { phone: "+972525991700", session: "531159495" },
    history: [
      { role: "user", content: "נציג שירות" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nקודם אמצא… (052-5991700)",
      },
      { role: "user", content: "כן" },
      {
        role: "assistant",
        content: "*הום בוט :)*\n… SO26021506 … נכון?",
      },
      { role: "user", content: "נכון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, המשלוח סומן כנמסר…\n\nאפשר לעזור במשהו נוסף?",
      },
    ],
    turn: { text: "כן נציג שירות", phone: "+972525991700" },
    assertions: [
      {
        type: "preTurn",
        handler: "post_order_completed",
        expect: "handled",
        action: "human_service",
        replyMustInclude: ["העברתי"],
        replyMustNotInclude: ["קודם אמצא"],
      },
      { type: "preTurn", handler: "order", expect: "skip" },
    ],
  },
  {
    id: "exchange-explicit-no-portal-532407210",
    description: "Explicit החלפה starts exchange intake — never returns portal",
    source: { session: "532407210" },
    history: [
      {
        role: "assistant",
        content: buildDissatisfactionRescueReply("+972532407210"),
      },
    ],
    turn: { text: "החלפה", phone: "+972532407210" },
    assertions: [
      {
        type: "preTurn",
        handler: "exchange_execution",
        expect: "handled",
        action: "reply",
        replyMustInclude: ["נמשיך עם החלפה"],
        replyMustNotInclude: ["returns.carpetshop.co.il", "החזרה וביטול"],
      },
      { type: "preTurn", handler: "kb_faq", expect: "skip" },
    ],
  },
  {
    id: "warm-close-thanks-532201347",
    description: "Thanks after resolved FAQ closes warmly — no follow-up question",
    source: { session: "532201347" },
    history: [
      { role: "user", content: "מה שעות הסניפים?" },
      {
        role: "assistant",
        content: "*הום בוט :)*\n…שעות הסניפים…\n\nשמחתי לעזור! 😊",
      },
    ],
    turn: { text: "תודה רבה" },
    assertions: [
      {
        type: "preTurn",
        handler: "guards",
        expect: "handled",
        action: "end",
        replyMustInclude: ["שמחתי לעזור"],
        replyMustNotInclude: ["במה עוד", "משהו נוסף"],
      },
    ],
  },
  {
    id: "packaging-faq-532185810",
    description: "How to open rug packaging — KB FAQ, not return policy or handoff",
    source: { session: "532185810" },
    history: [
      { role: "user", content: "יש לכם שטיחים?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nכן, יש מגוון שטיחים באתר ובסניפים. איזה סגנון מעניין אתכם?",
      },
    ],
    turn: { text: "איך פותחים את האריזה כשהשטיח מגיע?" },
    assertions: [
      {
        type: "preTurn",
        handler: "kb_faq",
        expect: "handled",
        action: "reply",
        replyMustInclude: ["מספריים", "פלסטיק"],
        replyMustNotInclude: ["באריזה המקורית", "human_service", "נציג"],
      },
      { type: "preTurn", handler: "inventory", expect: "skip" },
    ],
  },
  {
    id: "inventory-sku-bind-532185810",
    description: "Valid מק״ט after stock ask runs inventory — no re-ask or give-up",
    source: { session: "532185810" },
    history: [
      { role: "user", content: "יש במלאי בסניף בני ברק?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nכדי לבדוק מלאי בסניף אני צריך את המק״ט של הדגם (לדוגמה: 31503138-200290).",
      },
    ],
    turn: { text: "31503138-200290" },
    assertions: [
      { type: "preTurn", handler: "kb_faq", expect: "skip" },
      {
        type: "preTurn",
        handler: "inventory",
        expect: "handled",
        action: "reply",
        replyMustInclude: ["31503138-200290"],
        replyMustNotInclude: ["שלחו מק״ט", "אין לי אפשרות"],
      },
    ],
  },
  {
    id: "preorder-eta-unsatisfied-511324782",
    description: "Unhappy with preorder date → service human, never pitch cancel",
    source: { session: "511324782", landbotId: "511103877" },
    history: [
      { role: "user", content: "היישלום\nהזמנתי שטיח\nמתי הוא אמור להגיע?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (050-5713706)",
      },
      { role: "user", content: "כן" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני 31 ימים באתר אינטרנט על סך 1,125 ש׳׳ח נכון? (מס׳ הזמנה ⁦#75253⁩)",
      },
      { role: "user", content: "נכון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי את ההזמנה — הפריט רשום כהזמנה מוקדמת, ולכן עדיין אין סטטוס משלוח.\n\nאייקוניק אפור בהיר 290*200 ICONIC — הזמנה מוקדמת, צפי הגעה: 15/11/2026\n\nשמחתי לעזור! 😊",
      },
    ],
    turn: { text: "לא\nרוצה שירות לקוחות\nאו לבטל", phone: "0505713706" },
    assertions: [
      {
        type: "hints",
        hintMustMatch: [
          "PREORDER ETA UNSATISFIED",
          "human_service",
          "Never \"אין בעיה, אפשר לבטל\"",
        ],
      },
    ],
  },
]
