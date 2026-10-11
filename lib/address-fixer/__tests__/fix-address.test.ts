import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { fixAddressWithIndex, type AddressFixerOutput } from "@/lib/address-fixer"
import { getSnapshotIndex } from "@/lib/address-fixer/street-index"

const index = getSnapshotIndex()

function fix(city: string, fullStreet: string, apartmentFloor = "") {
  return fixAddressWithIndex(
    { city, full_street: fullStreet, apartment_floor: apartmentFloor },
    index
  )
}

type Expected = Partial<
  Pick<
    AddressFixerOutput,
    | "city"
    | "street"
    | "street_no"
    | "floor"
    | "apartment"
    | "entrance"
    | "street_matched"
    | "is_private_house"
  >
>

/** Inputs replayed from the v1.0 log (contact details removed). */
const CASES: Array<[string, string, string, Expected]> = [
  // v1.0 swapped in a different real street (`הראש` -> `הירקון`)
  ["תל אביב - יפו", "הראש 3", "קומה 16 דירה 92 ", { street: 'הרא"ש', street_no: "3", floor: "16", apartment: "92" }],
  // v1.0 split the house number (`ורדון 55` -> street 5, number 5)
  ["ורדון", "ורדון 55", " ", { street: "ורדון", street_no: "55" }],
  ["שפיים", "290", "1", { street: "שפיים", street_no: "290" }],
  ["שדה נחמיה", "90", "דרך השדה 90 ", { street: "שדה נחמיה", street_no: "90" }],
  ["רוחמה", "קיבוץ רוחמה ", "1", { street: "רוחמה", street_no: "1" }],
  // v1.0 invented floor 802
  ["רמת גן", "המתמיד 23", "קומה 8 דירה 82 ", { street: "המתמיד", street_no: "23", floor: "8", apartment: "82" }],
  ["בית שמש", "הרב קוק 22", "קומה 4 דירה 8", { street: "הרב קוק", street_no: "22", floor: "4", apartment: "8" }],
  ["הוד השרון", "גלגל המזלות 81", "0", { street: "גלגל המזלות", street_no: "81", is_private_house: true, floor: "", apartment: "" }],
  // city repeated inside the street line
  ["בת חפר", "שדרות הגליל  בת חפר 12", "0", { street: "שד הגליל", street_no: "12" }],
  ["פתח תקווה", "גדרה  כניסה א פתח תקווה 7", "קומה 0 דירה 1 ", { street: "גדרה", street_no: "7", floor: "0", apartment: "1", entrance: "א" }],
  ["תל אביב יפו", "דרך מנחם בגין , תל אביב 121", "", { street: "דרך בגין", street_no: "121" }],
  // city name words that are also street words stay put
  ["קרית גת", "שד גת 90", "8", { street: "שד גת", street_no: "90" }],
  ["רמת גן", "רמת חן 38", "1", { street: "רמת חן", street_no: "38" }],
  ["יתד", "יתד 233", "בית קרקע ", { street: "יתד", street_no: "233" }],
  // word order (חנה סנש / סנש חנה)
  ["הרצליה", "אריה לייב יפה ", "36 ג ", { street: "יפה אריה לייב", street_no: "36", entrance: "ג" }],
  ["גבעתיים", "יעקב פיינברג  גבעתיים 4", "", { street: "פינברג יעקב", street_no: "4" }],
  ["תל אביב", "ראול וולנברג 10", "", { street: "ולנברג ראול", street_no: "10" }],
  ["כפר סבא", "אברהם קרן 22", "", { street: "קרן אברהם", street_no: "22" }],
  // spelling (יעקב / יעקוב)
  ["חדרה", "דורי יעקוב 12", "", { street: "דורי יעקב", street_no: "12" }],
  ["נס ציונה", "האימהות 28", "", { street: "האמהות", street_no: "28" }],
  ["חיפה", "ואדי סאליב 10", "", { street: "ואדי סליב", street_no: "10" }],
  ["רעננה", "ברנדיב 38", "", { street: "ברנדיס", street_no: "38" }],
  // street-type and title prefixes
  ["בת ים", "רח׳ מקס נורדאו 15", "קומה 1 דירה 3", { street: "נורדאו מקס", street_no: "15", floor: "1", apartment: "3" }],
  ["תל אביב", "ההגנה 128", "", { street: "דרך ההגנה", street_no: "128" }],
  ["הרצליה", "יגאל אלון 4", "", { street: "אלוף אלון יגאל", street_no: "4" }],
  ["רעננה", "זרחין 2", "", { street: "זרחין אלכסנדר", street_no: "2" }],
  // English
  ["גבעת שמואל", "Levi eshkol 13 ", "קומה 1 דירה 3 ", { city: "גבעת שמואל", street: "לוי אשכול", street_no: "13", floor: "1", apartment: "3" }],
  ["TEL AVIV", "Rembrandt 20 ", "", { city: "תל אביב - יפו", street: "רמברנדט", street_no: "20" }],
  ["Holon", "Achi Dakar 6", "", { city: "חולון", street: 'אח"י דקר', street_no: "6" }],
  ["Tel Aviv", "20 Hatamar street ", "", { city: "תל אביב - יפו", street_no: "20" }],
  ["Nes Ziona", "Gordon 7", "", { city: "נס ציונה", street: "גורדון", street_no: "7" }],
  ["Tel Aviv", "12 Pinsker st.", "", { street: "פינסקר", street_no: "12" }],
  // `14/37` in the street line = house 14, apartment 37
  ["תל אביב - יפו", "ברדיצבסקי 14/37 1437", "", { street: "ברדיצ'בסקי", street_no: "14", apartment: "37" }],
  ["תל אביב", "ארלוזורוב 17, קומה 2, דירה 27, תל אביב-יפו 17227", " ", { street: "ארלוזורוב", street_no: "17", floor: "2", apartment: "27" }],
  ["הוד השרון", "חיים הרצוג 1 דירה 14 הוד השרון 114", "קומה 5 דירה 14 ", { street: "הרצוג חיים", street_no: "1", floor: "5", apartment: "14" }],
  // street typed into the units field
  ["כפר ורדים", "8", "8 צאלים", { street: "צאלים", street_no: "8" }],
  // units field holds the house number when the street line has none
  ["כפר סבא", "פיארברג ", "4", { street: "פיארברג", street_no: "4", apartment: "" }],
  // city spellings
  ["קריית אונו", "הביטחון 4", "", { city: "קרית אונו", street: "הבטחון", street_no: "4" }],
  ["מודיעין", "עמק האלה 33", "קומה 2 דירה 6", { city: "מודיעין-מכבים-רעות", street: "עמק האלה" }],
  ["פתח תקוה", "רוטשילד 10", "", { city: "פתח תקווה", street_matched: true }],
  ["נהרייה", "הגעתון 10", "", { city: "נהריה" }],
  ["בן שמן )מושב(", "הגפן 1", "", { city: "בן שמן (מושב)" }],
]

/** A real street exists with a similar name, but it is not this street. */
const MUST_NOT_SUBSTITUTE: Array<[string, string, string]> = [
  ["ירושלים", 'רמב"ם 5', "רמב\"ן"],
  ["תל אביב", "Israel Bak 11", "קרליבך"],
  ["פתח תקווה", "א ד גורדון", "ש גורדון"],
  ["קרית ארבע", "מרגלות חברון 61/7", "מעלות חברון"],
  ["הרצליה", "י.ל. גורדון 9", "גורדון א ד"],
  ["ראשון לציון", "חנה ומיכאל לוין 10", 'ח"ן'],
]

describe("fixAddress replay fixtures (v1.0 log)", () => {
  for (const [city, fullStreet, units, expected] of CASES) {
    it(`${city} | ${fullStreet.trim()} | ${units.trim()}`, () => {
      const output = fix(city, fullStreet, units)
      for (const [key, value] of Object.entries(expected)) {
        assert.equal(
          output[key as keyof Expected],
          value,
          `${key}: ${JSON.stringify(output)}`
        )
      }
    })
  }
})

describe("fixAddress never substitutes a different real street", () => {
  for (const [city, fullStreet, wrong] of MUST_NOT_SUBSTITUTE) {
    it(`${city} | ${fullStreet} is not ${wrong}`, () => {
      const output = fix(city, fullStreet)
      assert.notEqual(output.street, wrong)
    })
  }

  it("returns the customer's own street text when nothing matches", () => {
    const output = fix("ירושלים", 'רמב"ם 5')
    assert.equal(output.street_matched, false)
    assert.equal(output.street, 'רמב"ם')
    assert.equal(output.street_no, "5")
    assert.ok(output.notes.includes("street_not_found"))
  })
})

describe("fixAddress output contract", () => {
  it("always returns every key, even for empty / garbage input", () => {
    for (const input of [
      {},
      { city: null, full_street: undefined },
      { city: 5, full_street: { nested: true } },
      { city: "\u2060\u200f", full_street: "???", apartment_floor: "K-Express" },
      { city: "x".repeat(5000), full_street: "1".repeat(5000) },
    ]) {
      const output = fixAddressWithIndex(input, index)
      for (const key of [
        "ok",
        "city",
        "city_code",
        "city_matched",
        "street",
        "street_code",
        "street_matched",
        "street_no",
        "entrance",
        "floor",
        "apartment",
        "is_private_house",
        "confidence",
        "match_tier",
        "notes",
        "original",
      ]) {
        assert.ok(key in output, `missing ${key}`)
      }
      assert.equal(typeof output.street, "string")
      assert.equal(typeof output.floor, "string")
    }
  })

  it("handles quote characters in city and street names", () => {
    const output = fix("גבעת ניל''י", 'צה"ל 3')
    assert.equal(output.city_matched, true)
    const jerusalem = fix("ירושלים", "הפלמ״ח 10")
    assert.equal(jerusalem.street, 'הפלמ"ח')
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(jerusalem)))
  })

  it("returns gov codes for matched streets", () => {
    const output = fix("תל אביב - יפו", "דיזנגוף 100", "4/9")
    assert.equal(output.city_code, 5000)
    assert.equal(typeof output.street_code, "number")
    assert.deepEqual([output.floor, output.apartment], ["4", "9"])
  })
})
