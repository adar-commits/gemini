import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatCampaignLookupReply,
  isCampaignQuestion,
  isCouponCodeRequest,
  parseCampaignPayload,
  resolveCampaignLookupValue,
} from "@/lib/agents/campaign-lookup"
import { validatePriorityApiPayload } from "@/lib/agents/phone-for-api"

describe("campaign lookup", () => {
  it("detects campaign-related questions", () => {
    assert.equal(isCampaignQuestion("המבצע של 50% עדיין תקף?"), true)
    assert.equal(isCampaignQuestion("יש מבצע על שטיחים?"), true)
    assert.equal(isCampaignQuestion("מה מדיניות החזרה?"), false)
  })

  it("detects coupon code requests including typos (426446651)", () => {
    assert.equal(isCouponCodeRequest("הי אולי יש קוד הנחה ?"), true)
    assert.equal(isCouponCodeRequest("נשמח לקוד הנלה\nהנחה"), true)
    assert.equal(isCouponCodeRequest("כן"), false)
  })

  it("parses coupon_code from live API shape", () => {
    const rows = parseCampaignPayload([
      {
        campaign_name: "עד 70% הנחה +10% אקסטרה RED SALE",
        start_date: "2026-09-04",
        end_date: "2026-09-30",
        coupon_code: "RIMON10",
        valid_for: "website_only",
      },
    ])
    assert.equal(rows[0]?.couponCode, "RIMON10")
    assert.equal(rows[0]?.validFor, "website_only")
    assert.equal(rows[0]?.status, "active")
  })

  it("returns active coupon code for generic discount ask", () => {
    const reply = formatCampaignLookupReply(
      [
        {
          name: "עד 70% RED SALE",
          start: "2026-09-04",
          end: "2026-09-30",
          status: "active",
          couponCode: "RIMON10",
          validFor: "website_only",
        },
        {
          name: "שטיח החודש",
          start: "2026-09-01",
          end: "2026-09-30",
          status: "active",
          couponCode: null,
          validFor: null,
        },
      ],
      "all",
      "אולי יש קוד הנחה?"
    )
    assert.match(reply, /RIMON10/)
    assert.match(reply, /באתר/)
    assert.doesNotMatch(reply, /לא הבנתי/)
  })

  it("does not share coupon code for expired campaign", () => {
    const reply = formatCampaignLookupReply(
      [
        {
          name: "RED SALE",
          start: "2026-09-04",
          end: "2026-09-05",
          status: "expired",
          couponCode: "RIMON10",
          validFor: "website_only",
        },
      ],
      "RED SALE",
      "יש קוד ל-RED SALE?"
    )
    assert.match(reply, /אינו בתוקף/)
    assert.match(reply, /לא בתוקף/)
    assert.doesNotMatch(reply, /קוד הקופון: RIMON10/)
  })

  it("accepts getCampaigns payloads with all or hint", () => {
    assert.equal(
      validatePriorityApiPayload({ actionType: "getCampaigns", value: "all" }).ok,
      true
    )
    assert.equal(
      validatePriorityApiPayload({ actionType: "getCampaigns", value: "השטיח האדום" }).ok,
      true
    )
  })

  it("parses campaign rows with flexible field names", () => {
    const rows = parseCampaignPayload([
      {
        name: "השטיח האדום 50%",
        startDate: "2026-08-14T11:30:00Z",
        endDate: "2026-08-26T06:00:00Z",
      },
      {
        title: "Pozitive 1+1",
        validFrom: "2026-08-11T06:30:00Z",
        validTo: "2026-08-18T06:00:00Z",
        active: false,
      },
    ])

    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.name, "השטיח האדום 50%")
    assert.equal(rows[1]?.status, "expired")
  })

  it("parses live getCampaigns API shape with snake_case and wrapper", () => {
    const rows = parseCampaignPayload([
      {
        ok: true,
        count: 4,
        campaigns: [
          {
            campaign_name: "מאות שטיחים ב-65% הנחה",
            start_date: "2026-08-16",
            end_date: "2026-09-30",
          },
          {
            campaign_name: "הכל ב-50% הנחה",
            start_date: "2026-08-14",
            end_date: "2026-08-31",
          },
          {
            campaign_name: "לילה לבן 15% (בדיקה)",
            start_date: "2026-04-15",
            end_date: "2026-04-21",
          },
        ],
      },
    ])

    assert.equal(rows.length, 3)
    assert.equal(rows[0]?.name, "מאות שטיחים ב-65% הנחה")
    assert.equal(rows[0]?.status, "active")
    assert.equal(rows[2]?.status, "expired")
  })

  it("summarizes active campaigns for general promotion ask without dumping expired ones", () => {
    const reply = formatCampaignLookupReply(
      [
        {
          name: "מאות שטיחים ב-65% הנחה",
          start: "2026-08-16",
          end: "2026-09-30",
          status: "active",
          couponCode: null,
          validFor: null,
        },
        {
          name: "הכל ב-50% הנחה",
          start: "2026-08-14",
          end: "2026-08-31",
          status: "expired",
          couponCode: null,
          validFor: null,
        },
      ],
      "all"
    )
    assert.match(reply, /בדקתי בשבילכם/)
    assert.match(reply, /65%/)
    assert.match(reply, /בתוקף/)
    assert.doesNotMatch(reply, /50% הנחה/)
    assert.doesNotMatch(reply, /•/)
  })

  it("extracts campaign hint from customer message", () => {
    assert.equal(
      resolveCampaignLookupValue("המבצע השטיח האדום עדיין בתוקף?", null),
      "השטיח האדום"
    )
    assert.equal(
      resolveCampaignLookupValue("המבצע של 1+1 עדיין בתוקף?", null),
      "1+1"
    )
    assert.equal(resolveCampaignLookupValue("יש מבצעים?", "all"), "all")
  })

  it("formats a friendly reply for a specific active campaign", () => {
    const reply = formatCampaignLookupReply(
      [
        {
          name: "השטיח האדום 50%",
          start: "2026-08-14T11:30:00Z",
          end: "2026-09-10T06:00:00Z",
          status: "active",
          couponCode: null,
          validFor: null,
        },
      ],
      "השטיח האדום"
    )
    assert.match(reply, /השטיח האדום/)
    assert.match(reply, /עדיין בתוקף/)
    assert.doesNotMatch(reply, /•/)
  })

  it("answers a specific 1+1 ask with one sentence, not all campaigns", () => {
    const reply = formatCampaignLookupReply(
      [
        {
          name: "1+1 על כל הפופים",
          start: "2026-08-11",
          end: "2026-08-31",
          status: "expired",
          couponCode: null,
          validFor: null,
        },
        {
          name: "הכל ב-50% הנחה",
          start: "2026-08-14",
          end: "2026-08-31",
          status: "expired",
          couponCode: null,
          validFor: null,
        },
        {
          name: "מאות שטיחים ב-65% הנחה",
          start: "2026-08-16",
          end: "2026-09-30",
          status: "active",
          couponCode: null,
          validFor: null,
        },
      ],
      "1+1",
      "המבצע של 1+1 עדיין בתוקף?"
    )
    assert.match(reply, /1\+1/)
    assert.match(reply, /פופים/)
    assert.match(reply, /אינו בתוקף/)
    assert.doesNotMatch(reply, /65%/)
    assert.doesNotMatch(reply, /•/)
  })
})
