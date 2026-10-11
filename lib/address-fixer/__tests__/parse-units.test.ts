import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hebrewLetterToNumber, parseAddressUnits } from "@/lib/address-fixer/parse-units"

function units(fullStreet: string, apartmentFloor = "") {
  const parsed = parseAddressUnits(fullStreet, apartmentFloor)
  return {
    floor: parsed.floor,
    apartment: parsed.apartment,
    entrance: parsed.entrance,
    house: parsed.isPrivateHouse,
  }
}

describe("address fixer unit parsing", () => {
  it("reads labeled floor and apartment in either order", () => {
    assert.deepEqual(units("הרב קוק 22", "קומה 4 דירה 8"), {
      floor: "4",
      apartment: "8",
      entrance: "",
      house: false,
    })
    assert.deepEqual(units("רמז 1", "דירה 12 קומה 3").floor, "3")
    assert.deepEqual(units("רמז 1", "דירה 12 קומה 3").apartment, "12")
  })

  it("never invents digits (v1.0 turned `קומה 8 דירה 82` into floor 802)", () => {
    const parsed = units("המתמיד 23", "קומה 8 דירה 82 ")
    assert.equal(parsed.floor, "8")
    assert.equal(parsed.apartment, "82")
  })

  it("orders a bare pair so the smaller number is the floor", () => {
    assert.deepEqual([units("x 1", "4/9").floor, units("x 1", "4/9").apartment], ["4", "9"])
    assert.deepEqual([units("x 1", "9/4").floor, units("x 1", "9/4").apartment], ["4", "9"])
    assert.deepEqual([units("x 1", "3 12").floor, units("x 1", "3 12").apartment], ["3", "12"])
    assert.deepEqual([units("x 1", "4-6").floor, units("x 1", "4-6").apartment], ["4", "6"])
  })

  it("maps Hebrew letters and words to floor numbers", () => {
    assert.equal(units("x 1", "קומה א דירה 3").floor, "1")
    assert.equal(units("x 1", "קומה ב'").floor, "2")
    assert.equal(units("x 1", "קומה ראשונה דירה 5").floor, "1")
    assert.equal(units("x 1", "קומת קרקע דירה 3").floor, "0")
    assert.equal(units("x 1", "קרקע").floor, "0")
    assert.equal(units("x 1", "קומה -1 דירה 2").floor, "-1")
    assert.equal(units("x 1", "קומה מינוס 2 דירה 2").floor, "-2")
    assert.equal(hebrewLetterToNumber("יב"), 12)
    assert.equal(hebrewLetterToNumber("טו"), 15)
    assert.equal(hebrewLetterToNumber("שלום"), null)
  })

  it("tolerates typos and missing spaces in the labels", () => {
    assert.deepEqual([units("x 1", "קונה 2 דירה 7").floor, units("x 1", "קונה 2 דירה 7").apartment], ["2", "7"])
    assert.deepEqual([units("x 1", "קומה3 דירה11").floor, units("x 1", "קומה3 דירה11").apartment], ["3", "11"])
  })

  it("treats 0 / private-house wording as a private house with no units", () => {
    assert.deepEqual(units("גלגל המזלות 81", "0"), {
      floor: "",
      apartment: "",
      entrance: "",
      house: true,
    })
    assert.equal(units("קשת 18", "בית פרטי").house, true)
    assert.equal(units("ורדון 55", "").house, true)
  })

  it("reads entrances", () => {
    assert.equal(units("x 1", "כניסה ב קומה 3 דירה 9").entrance, "ב")
    assert.equal(units("x 1", "כניסה ב' קומה 3").entrance, "ב")
    assert.equal(units("x 1", "א").entrance, "א")
  })

  it("reads English unit labels", () => {
    assert.deepEqual([units("x 1", "Apt 4 1st floor").floor, units("x 1", "Apt 4 1st floor").apartment], ["1", "4"])
    assert.equal(units("x 1", "Apt. 17").apartment, "17")
    assert.equal(units("x 1", "Entrance ד floor 5 apartment 11").entrance, "ד")
  })

  it("uses the leftover number as the floor once the apartment is labeled", () => {
    const parsed = units("איפרגן 6", "3 דירה 9")
    assert.deepEqual([parsed.floor, parsed.apartment], ["3", "9"])
  })

  it("does not read PO-box text inside street names (`יתד 233`)", () => {
    const parsed = parseAddressUnits("יתד 233", "")
    assert.equal(parsed.streetText, "יתד 233")
    const box = parseAddressUnits("ת.ד. 150", "")
    assert.ok(box.notes.includes("removed_po_box"))
  })
})
