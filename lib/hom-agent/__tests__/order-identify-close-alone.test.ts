import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { buildDeliveryEstimatePolicyReply } from "@/lib/agents/delivery-estimate-policy"
import { rememberOrdersLookup } from "@/lib/agents/order-lookup-cache"
import { isIdentificationOnlyOrderLookup } from "@/lib/agents/order-identify-lookup"
import {
  extractPhoneFromText,
  mapPriorityOrderRow,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"

const H = "*הום בוט :)*\n"

function order(partial: Parameters<typeof mapPriorityOrderRow>[0]) {
  return mapPriorityOrderRow(partial)
}

describe("typed order number after a completed lookup (435213398)", () => {
  const phone = "0524727511"
  rememberOrdersLookup(phone, [
    order({ ORDNAME: "SO26023875", ORDSTATUSDES: "בביצוע", CURDATE: "2026-09-28T10:00:00+03:00", TOTPRICE: 200 }),
    order({ ORDNAME: "SO26023873", ORDSTATUSDES: "בביצוע", CURDATE: "2026-09-28T09:58:00+03:00", TOTPRICE: 200 }),
  ])
  const history: HistoryMessage[] = [
    { role: "user", content: "אשמח לדעת מתי בערך יגיעו שני השטיחים החדשים?" },
    { role: "assistant", content: `${H}יש לך את מספר ההזמנה (למשל #76884 או SO26005938)?` },
    { role: "user", content: "RC269021734" },
    { role: "assistant", content: `${H}לא מצאתי את ההזמנה ⁦RC269021734⁩ על הטלפון (052-4727511).\nמה מספר הטלפון שבוצעה עליו ההזמנה?` },
    { role: "user", content: phone },
    { role: "assistant", content: `${H}מצאתי הזמנה שבוצעה לפני 13 ימים באתר אינטרנט, על סך 200 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦SO26023875⁩)` },
    { role: "user", content: "כן\nועוד שטיח" },
    { role: "assistant", content: `${H}בדקתי, סטטוס ההזמנה במערכת: בביצוע.\n\nאם יש משהו נוסף שאוכל לעזור בו, אני כאן 😊` },
    { role: "user", content: "יש עוד שטיח שהזמנתי דגם race" },
    { role: "assistant", content: `${H}יש לך מספר הזמנה של שטיח ה-race (למשל #76884)?` },
  ]

  it("looks up the typed order, not the receipt from earlier in the thread", async () => {
    const reply = await resolveOrderShippingReply({ body: "S026023873", phone, history })
    assert.doesNotMatch(reply, /SO26023875/)
    assert.doesNotMatch(reply, /זו ההזמנה\?/)
    assert.match(reply, /בדקתי/)
  })

  it("never reads digits of an order id as a phone", () => {
    assert.equal(extractPhoneFromText("1) דגם רייס בז S026023873\n2) דגם בל S026023875"), null)
    assert.equal(extractPhoneFromText("הטלפון שלי 054-7495083"), "0547495083")
  })
})

describe("order lookup only identifies the order (505729214)", () => {
  const phone = "0501112233"
  rememberOrdersLookup(phone, [
    order({ ORDNAME: "SO26011111", ORDSTATUSDES: "הושלם", ZPIT_DELSTATUSCODE: "5", ZPIT_DELSTATUSDES: "בדרך", CURDATE: "2026-10-01T10:00:00+03:00", TOTPRICE: 900 }),
  ])
  const history: HistoryMessage[] = [
    { role: "user", content: "חויבתי פעמיים על ההזמנה" },
    {
      role: "assistant",
      content: `${H}מצאתי הזמנה שבוצעה לפני 10 ימים באתר אינטרנט, על סך 900 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦SO26011111⁩)`,
      awaiting: "order_identify",
    },
  ]

  it("tracks the identification chain until the order is resolved", () => {
    assert.equal(isIdentificationOnlyOrderLookup(history), true)
    const closed: HistoryMessage[] = [
      ...history,
      { role: "user", content: "כן" },
      { role: "assistant", content: `${H}הבנתי, החיוב הכפול יטופל על ידי נציג שירות.` },
    ]
    assert.equal(isIdentificationOnlyOrderLookup(closed), false)
  })

  it("confirm returns order data, not a shipment-status card", async () => {
    const result = await executeLookupOrderStatus({ body: "כן", phone, history })
    assert.equal(result.ok, true)
    assert.ok("identifiedOrder" in result)
    if (!("identifiedOrder" in result)) return
    assert.equal(result.identifiedOrder.orderNumber, "SO26011111")
    assert.equal(result.identifiedOrder.shippingStatusCode, "5")
    assert.equal("reply" in result, false)
  })

  it("pre-turn releases the confirm turn to the LLM", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "כן", media: [] },
      history,
      phone,
    })
    assert.equal(result.kind, "skip")
  })

  it("teaches identify-only lookups in hints and prompt", () => {
    const hints = buildConversationHints({ body: "כן", history })
    assert.match(hints ?? "", /ORDER IDENTIFIED FOR REQUEST \(505729214\)/)
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    assert.match(prompt, /Order lookup ≠ shipment status \(505729214\)/)
    assert.match(prompt, /purpose: "identify_order"/)
  })
})

describe("exchange by courier keeps the exchange (532899816)", () => {
  const phone = "0526272913"
  rememberOrdersLookup(phone, [
    order({ ORDNAME: "SO26022222", REFERENCE: "77293", ORDSTATUSDES: "הושלם", ZPIT_DELSTATUSCODE: "6", ZPIT_DELSTATUSDES: "נמסר", CURDATE: "2026-09-20T10:00:00+03:00", TOTPRICE: 520 }),
  ])
  const history: HistoryMessage[] = [
    { role: "user", content: "אני רוצה להחזיר מוצר שקניתי" },
    {
      role: "assistant",
      content: `${H}בשמחה, נסדר את זה. יש שתי אפשרויות:\n\n1. *החלפה*: בוחרים מוצר אחר שיתאים יותר (להחלפה לא צריך את הפורטל)\n2. *החזרה וביטול*: מחזירים באחד מ*סניפי הרשת* (ללא עלות) או עם שליח (בתשלום, לפי גודל המוצר). רק במסלול הזה פותחים בקשה ב-returns.carpetshop.co.il, גם כשמחזירים בסניף\n\nמה מתאים לך יותר?`,
    },
    { role: "user", content: "1" },
    { role: "assistant", content: `${H}נמשיך עם החלפה 😊 תרצו להחליף בסניף או עם שליח?` },
    { role: "user", content: "עם שליח" },
    {
      role: "assistant",
      content: `${H}מצאתי הזמנה שבוצעה לפני 21 ימים באתר אינטרנט, על סך 520 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦#77293⁩)`,
      awaiting: "order_identify",
    },
  ]

  it("order card confirm never becomes a «בקשת החזרה» service summary", async () => {
    const preTurn = await runStructuredOrderLookupPreTurn({
      turn: { text: "כן", media: [] },
      history,
      phone,
    })
    if (preTurn.kind === "handled") {
      assert.doesNotMatch(preTurn.reply, /בקשת החזרה/)
      assert.doesNotMatch(preTurn.reply, /בדקתי/)
    }
    const tool = await executeLookupOrderStatus({ body: "כן", phone, history })
    assert.equal(tool.ok, true)
    assert.ok("identifiedOrder" in tool)
  })

  it("teaches branch-or-courier and knows → service / unsure → sales", () => {
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    assert.match(prompt, /תרצו להחליף בסניף או עם שליח/)
    assert.match(prompt, /User knows .*action human_service/)
    assert.match(prompt, /User does not know .*action human_sales/)
    assert.match(prompt, /cancel routing by shipping code \(464488405 \/ 532899816/)
  })
})

describe("in-window delivery answers close without a rep offer", () => {
  it("delivered and coordinated statuses do not ask להעביר לנציג", () => {
    const delivered = buildDeliveryEstimatePolicyReply(
      order({ ORDNAME: "SO1", ZPIT_DELSTATUSCODE: "6", ZPIT_DELSTATUSDES: "נמסר" })
    )
    assert.doesNotMatch(delivered, /האם להעביר/)
    const coordinated = buildDeliveryEstimatePolicyReply(
      order({ ORDNAME: "SO2", ZPIT_DELSTATUSCODE: "80", ZPIT_DELSTATUSDES: "תואם", ZPIT_COORDATE: "2026-10-14T10:00:00+03:00" })
    )
    assert.doesNotMatch(coordinated, /האם להעביר/)
    assert.match(coordinated, /שמחתי לעזור/)
  })
})
