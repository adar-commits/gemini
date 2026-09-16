import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  parseDocumentLinkFromPayload,
  parseDocumentLinksFromPayload,
} from "@/lib/agents/get-document-parse"

describe("getDocument payload parsing", () => {
  it("parses legacy { result } shape", () => {
    const payload = { result: "https://documents.carpetshop.co.il/documents/legacy-id" }
    assert.equal(parseDocumentLinkFromPayload(payload), payload.result)
  })

  it("parses results-array shape wrapped in top-level array (532360395)", () => {
    const payload = [
      {
        status: "success",
        data: {
          invoice_number: "IN264019410",
          count: 1,
          results: [
            {
              id: "1368b94a-e1d0-4b3f-9cba-13826dc90e74",
              link: "https://documents.carpetshop.co.il/documents/1368b94a-e1d0-4b3f-9cba-13826dc90e74",
              pdf_link:
                "https://documents.carpetshop.co.il/documents/1368b94a-e1d0-4b3f-9cba-13826dc90e74/pdf",
              type: "invoice",
            },
          ],
        },
      },
    ]

    const links = parseDocumentLinksFromPayload(payload)
    assert.equal(links.length, 1)
    assert.equal(
      links[0],
      "https://documents.carpetshop.co.il/documents/1368b94a-e1d0-4b3f-9cba-13826dc90e74"
    )
    assert.equal(parseDocumentLinkFromPayload(payload), links[0])
  })

  it("parses unwrapped success envelope", () => {
    const payload = {
      status: "success",
      data: {
        results: [{ link: "https://documents.carpetshop.co.il/documents/unwrapped" }],
      },
    }
    assert.equal(
      parseDocumentLinkFromPayload(payload),
      "https://documents.carpetshop.co.il/documents/unwrapped"
    )
  })

  it("falls back to pdf_link when link is missing", () => {
    const payload = {
      data: {
        results: [{ pdf_link: "https://documents.carpetshop.co.il/documents/pdf-only/pdf" }],
      },
    }
    assert.equal(
      parseDocumentLinkFromPayload(payload),
      "https://documents.carpetshop.co.il/documents/pdf-only/pdf"
    )
  })

  it("returns empty when payload has no links", () => {
    assert.deepEqual(parseDocumentLinksFromPayload({ status: "success", data: { results: [] } }), [])
    assert.equal(parseDocumentLinkFromPayload(null), null)
  })
})
