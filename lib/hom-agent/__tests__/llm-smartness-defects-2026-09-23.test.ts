import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCustomerImageAckReply,
  shouldAckCustomerImageWithoutVision,
} from "@/lib/agents/customer-image-turn"
import {
  isConversationClosing,
  isThanksWithSubstance,
  isThreadReadyForThanksClose,
} from "@/lib/agents/conversation-close"
import { formatHebrewCustomerDate } from "@/lib/agents/hebrew-date-format"
import {
  buildInventoryAvailabilityReply,
  buildInventorySizeMismatchConfirmReply,
  resolveBranchInventoryReply,
} from "@/lib/agents/inventory-lookup"
import {
  extractStatedProductSize,
  sizeLabelFromSku,
  statedSizeMatchesSku,
} from "@/lib/agents/inventory-size-reconcile"
import {
  buildOrderConfirmationPrompt,
  mapPriorityOrderRow,
} from "@/lib/agents/order-lookup"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"
import type { InventoryBranchRow } from "@/lib/agents/inventory-lookup"

/** 533146618 — Luna / size vs link + thanks+discount + IL dates */
describe("533146618 inventory size and thanks substance", () => {
  it("detects size mismatch between stated XXL/240×340 and link SKU 200×290", () => {
    const stated = extractStatedProductSize("XXL 240×340")
    assert.ok(stated)
    assert.equal(statedSizeMatchesSku(stated!, "31503138-200290"), false)
    assert.equal(sizeLabelFromSku("31503138-200290"), "200×290")
  })

  it("asks which size before inventory answer when text and link disagree", async () => {
    const reply = await resolveBranchInventoryReply({
      body: "240×340 https://www.carpetshop.co.il/products/luna-31503138-200290",
      history: [{ role: "user", content: "יש XXL?" }],
    })
    assert.match(reply, /240×340/)
    assert.match(reply, /200×290/)
    assert.match(reply, /איזו מידה/)
  })

  it("formats preorder ETA as dd/mm/yyyy not ISO", () => {
    const row: InventoryBranchRow = {
      sku: "31503138-200290",
      product_title: "Luna",
      preorder: {
        po_qty: 1,
        open_order_qty: 0,
        current_qty: 0,
        safe_qty: 0,
        req_date: "2026-11-15",
      },
      inventory: [],
    }
    const reply = buildInventoryAvailabilityReply(row)
    assert.match(reply, /15\/11\/2026/)
    assert.doesNotMatch(reply, /2026-11-15/)
  })

  it("does not treat thanks+discount question as conversation close", () => {
    const body = "תודה רבה, אם אני מזמינה עכשיו אני מקבלת את ההנחה?"
    assert.equal(isThanksWithSubstance(body), true)
    assert.equal(isConversationClosing(body), false)
  })

  it("defers thanks+substance to the LLM", () => {
    const result = runPreTurnGuards({
      turn: {
        text: "תודה רבה, אם אני מזמינה עכשיו אני מקבלת את ההנחה?",
        media: [],
      },
      history: [
        {
          role: "assistant",
          content: "*הום בוט :)*\nבדקתי, הדגם זמין להזמנה מוקדמת.",
        },
      ],
    })
    assert.equal(result.kind, "skip")
  })
})

/** 533141804 — image+text must not be silent */
describe("533141804 customer image ack", () => {
  it("acks image turns without vision", () => {
    const turn = {
      text: "אני מחפשת שטיח כזה איזה מידות יש לכם?",
      media: [{ kind: "image" as const, url: "https://example.com/photo.jpg" }],
    }
    assert.equal(
      shouldAckCustomerImageWithoutVision({ turn, history: [] }),
      true
    )
    const result = runPreTurnGuards({ turn, history: [] })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /קיבלתי את התמונה/)
    assert.equal(result.action, "reply")
  })

  it("builds non-empty ack for image-only caption", () => {
    const reply = buildCustomerImageAckReply(
      "אני מחפשת שטיח כזה [media:image:https://x]"
    )
    assert.match(reply, /קיבלתי את התמונה/)
  })
})

/** 532521979 — address change → order # + human_service, not *3076 primary */
describe("532521979 address change service intake", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "היי, אני צריכה לשנות את הכתובת למשלוח לכתובת החדשה 29 בנובמבר 7 הרצליה",
    },
  ]

  it("hints order number + human_service, not phone deflect", () => {
    const hints = buildConversationHints({
      body: history[0]!.content,
      history,
    })
    assert.match(hints ?? "", /532521979|מספר הזמנה|human_service/i)
    assert.doesNotMatch(hints ?? "", /077-9725055/)
  })
})

/** 375557582 — person name must not appear as branch; old orders need confirm note */
describe("375557582 order branch label", () => {
  it("shows סניף prefix and not a salesperson person name", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO24011857",
      CURDATE: "2024-01-18T00:00:00Z",
      Y_7455_0_ESH: "שרה בר יוסף",
      LTRN_SELLERNAME: "שרה בר יוסף",
      ZPIT_DISTERIBRANCH: "נתניה",
      TOTPRICE: 1200,
    })
    const prompt = buildOrderConfirmationPrompt(order, [])
    assert.match(prompt, /סניף/)
    assert.doesNotMatch(prompt, /שרה בר יוסף/)
  })

  it("notes very old orders in the confirm card", () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 866)
    const prompt = buildOrderConfirmationPrompt(
      {
        orderNumber: "SO24011857",
        totalPrice: 1200,
        branchLabel: "סניף נתניה",
        statusCode: "",
        statusLabel: "",
        statusDescription: "",
        raw: { CURDATE: oldDate.toISOString() },
      },
      []
    )
    assert.match(prompt, /הזמנה ישנה/)
  })
})

/** 529963697 — thanks alone stays open; resolved thread may close */
describe("529963697 thanks close policy", () => {
  it("pure thanks stays open when request not clearly resolved", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history: [
        {
          role: "assistant",
          content: "*הום בוט :)*\nהזמנה מוקדמת — צפי הגעה 15/11/2026.",
        },
      ],
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.doesNotMatch(result.reply, /שמחתי לעזור היום/)
  })

  it("allows close after a resolved status card", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, ההזמנה בדרך.\n\nשמחתי לעזור! 😊",
      },
    ]
    assert.equal(isThreadReadyForThanksClose(history), true)
  })
})

/** 532452401 — cancel/exchange must not confused-fallback */
describe("532452401 cancel exchange service intake hint", () => {
  it("hints service intake for cancel language", () => {
    const hints = buildConversationHints({
      body: "אני רוצה לבטל את ההזמנה ולהחליף מוצר",
      history: [],
    })
    assert.match(hints ?? "", /CANCEL\/EXCHANGE EXECUTION/)
    assert.match(hints ?? "", /human_service/)
    assert.match(hints ?? "", /מספר הזמנה/)
  })
})

describe("inventory size confirm builder", () => {
  it("builds explicit mismatch confirm copy", () => {
    const reply = buildInventorySizeMismatchConfirmReply({
      statedSize: "240×340",
      linkSize: "200×290",
      sku: "31503138-200290",
    })
    assert.match(reply, /31503138-200290/)
  })
})

describe("hebrew date format sanity", () => {
  it("formats ISO to IL customer date", () => {
    assert.equal(formatHebrewCustomerDate("2026-11-15"), "15/11/2026")
  })
})
