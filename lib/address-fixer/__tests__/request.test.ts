import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractFieldsFromBrokenJson,
  readAddressFixerInput,
} from "@/lib/address-fixer/request"

function post(body: string, contentType = "application/json", query = "") {
  return new Request(`https://example.test/api/address-fixer${query}`, {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  })
}

describe("address fixer request parsing", () => {
  it("reads strict JSON", async () => {
    const { input, parse } = await readAddressFixerInput(
      post(JSON.stringify({ city: "חיפה", full_street: "הרצל 5", apartment_floor: "קומה 2" }))
    )
    assert.equal(parse, "json")
    assert.deepEqual(input, { city: "חיפה", full_street: "הרצל 5", apartment_floor: "קומה 2" })
  })

  it("repairs JSON broken by an unescaped gershayim (רמב\"ם)", async () => {
    const raw = '{"city": "ירושלים", "full_street": "רמב"ם 5", "apartment_floor": "קומה 1 דירה 2"}'
    const { input, parse } = await readAddressFixerInput(post(raw))
    assert.equal(parse, "json_repaired")
    assert.equal(input.city, "ירושלים")
    assert.equal(input.full_street, 'רמב"ם 5')
    assert.equal(input.apartment_floor, "קומה 1 דירה 2")
  })

  it("repairs broken JSON where the quoted value is last", () => {
    const repaired = extractFieldsFromBrokenJson(
      '{"full_street": "הפלמ"ח 3", "city": "גבעת כ"ח"}'
    )
    assert.equal(repaired.full_street, 'הפלמ"ח 3')
    assert.equal(repaired.city, 'גבעת כ"ח')
  })

  it("accepts alias field names and nested n8n bodies", async () => {
    const { input } = await readAddressFixerInput(
      post(JSON.stringify({ body: { City: "חולון", FullStreet: "סוקולוב 1" } }))
    )
    assert.deepEqual(input, { city: "חולון", full_street: "סוקולוב 1" })
  })

  it("accepts form bodies and query params", async () => {
    const form = await readAddressFixerInput(
      post("city=%D7%97%D7%99%D7%A4%D7%94&full_street=x+1", "application/x-www-form-urlencoded")
    )
    assert.equal(form.parse, "form")
    assert.equal(form.input.city, "חיפה")

    const query = await readAddressFixerInput(post("", "text/plain", "?city=a&full_street=b"))
    assert.equal(query.parse, "query")
    assert.deepEqual(query.input, { city: "a", full_street: "b" })
  })

  it("returns empty input instead of throwing on garbage", async () => {
    const { input, parse } = await readAddressFixerInput(post("{{{not json"))
    assert.equal(parse, "empty")
    assert.deepEqual(input, {})
  })
})
