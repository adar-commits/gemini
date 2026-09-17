import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isCatalogProductInquiry,
  isHomStorefrontUrl,
  isProductDetailsRequest,
} from "@/lib/agents/product-handoff"
import { requiresOrderIdentification } from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"

/** Replay 349175077 / Talya — site product details must not start order lookup. */
const LANDBOT_DETAILS =
  "היי אשמח לפרטים נוספים לגבי שטיח בלנקה לבן-בז' BLANKA שטיח בלנקה לבן-בז' BLANKA"
const SHAPE_PHOTO =
  "אשמח לדעת אם זו הצורה שלו\n[תמונה: אשמח לדעת אם זו הצורה שלו][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/349081508/photo.jpg]"
const PRODUCT_URL =
  "https://www.carpetshop.co.il/products/blanka-white-beige?variant=44355920298175"

describe("catalog product inquiry 349175077", () => {
  it("detects Landbot details + storefront URL as catalog, not order ID", () => {
    assert.equal(isProductDetailsRequest(LANDBOT_DETAILS), true)
    assert.equal(isCatalogProductInquiry(LANDBOT_DETAILS, []), true)
    assert.equal(isHomStorefrontUrl(PRODUCT_URL), true)
    assert.equal(isCatalogProductInquiry(PRODUCT_URL, []), true)
    assert.equal(requiresOrderIdentification(LANDBOT_DETAILS, []), false)
    assert.equal(requiresOrderIdentification(SHAPE_PHOTO, []), false)
  })

  it("hints sales catalog and never order lookup", () => {
    const hints = buildConversationHints({
      body: `${LANDBOT_DETAILS}\n${PRODUCT_URL}\n${SHAPE_PHOTO}`,
      history: [],
      whatsappPhone: "+972546814362",
    })
    assert.match(hints ?? "", /CATALOG PRODUCT/)
    assert.match(hints ?? "", /Never lookup_order_status/)
  })

  it("refuses lookup_order_status on the photo follow-up", async () => {
    const history: HistoryMessage[] = [{ role: "user", content: LANDBOT_DETAILS }]
    const tool = await executeLookupOrderStatus({
      body: SHAPE_PHOTO,
      history,
      phone: "+972546814362",
    })
    assert.equal(tool.ok, false)
    if (tool.ok) return
    assert.equal(tool.errorCode, "lookup_misroute")
    assert.match(tool.error, /sales|product|פרטים/i)

    const preTurn = await runStructuredOrderLookupPreTurn({
      turn: { text: SHAPE_PHOTO, media: [] },
      history,
      phone: "+972546814362",
    })
    assert.equal(preTurn.kind, "skip")
  })

  it("still allows lookup when they ask about an existing shipment", async () => {
    const result = await executeLookupOrderStatus({
      body: "אני מבקש לדעת מתי יגיע השטיח שהזמנו",
      history: [],
      phone: "+972546814362",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.match(result.reply, /רשומה על המספר|מספר ההזמנה|טלפון/)
  })
})
