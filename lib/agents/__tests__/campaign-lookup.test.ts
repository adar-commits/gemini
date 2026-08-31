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
