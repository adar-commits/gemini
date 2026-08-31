import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatCampaignLookupReply,
  isCampaignQuestion,
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

  it("lists active campaigns for general promotion ask", () => {
    const reply = formatCampaignLookupReply(
      [
        {
          name: "מאות שטיחים ב-65% הנחה",
          start: "2026-08-16",
          end: "2026-09-30",
          status: "active",
        },
        {
          name: "הכל ב-50% הנחה",
          start: "2026-08-14",
          end: "2026-08-31",
          status: "expired",
        },
      ],
      "all"
    )
    assert.match(reply, /כן — אלה המבצעים הפעילים/)
    assert.match(reply, /65%/)
    assert.doesNotMatch(reply, /50% הנחה/)
  })

  it("extracts campaign hint from customer message", () => {
    assert.equal(
      resolveCampaignLookupValue("המבצע השטיח האדום עדיין בתוקף?", null),
      "השטיח האדום"
    )
    assert.equal(resolveCampaignLookupValue("יש מבצעים?", "all"), "all")
  })

  it("formats Hebrew campaign reply", () => {
    const reply = formatCampaignLookupReply(
      [
        {
          name: "השטיח האדום 50%",
          start: "2026-08-14T11:30:00Z",
          end: "2026-09-10T06:00:00Z",
          status: "active",
        },
      ],
      "השטיח האדום"
    )
    assert.match(reply, /השטיח האדום 50%/)
    assert.match(reply, /פעיל/)
  })
})
