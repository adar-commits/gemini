/**
 * Deterministic parsing of floor / apartment / entrance / house number out of
 * free-text Israeli address lines.
 *
 * Nothing here guesses a value that is not present in the input: when the text
 * is ambiguous the field is left empty and a note is recorded instead.
 */

import { cleanText } from "./normalize"

export interface UnitParseResult {
  floor: string
  apartment: string
  entrance: string
  /** House number, when it could be read without knowing the street yet. */
  houseNumber: string
  /** Apartment came from a bare unlabeled number — may really be the house number. */
  apartmentFromBareNumber: boolean
  isPrivateHouse: boolean
  /** Street line with every consumed span removed. */
  streetText: string
  notes: string[]
}

const HEBREW_NUMERALS: Record<string, number> = {
  א: 1,
  ב: 2,
  ג: 3,
  ד: 4,
  ה: 5,
  ו: 6,
  ז: 7,
  ח: 8,
  ט: 9,
  י: 10,
  כ: 20,
  ל: 30,
}

const FLOOR_WORDS: Record<string, number> = {
  קרקע: 0,
  כניסה: 0,
  ראשונה: 1,
  ראשון: 1,
  שניה: 2,
  שנייה: 2,
  שני: 2,
  שלישית: 3,
  שלישי: 3,
  רביעית: 4,
  רביעי: 4,
  חמישית: 5,
  חמישי: 5,
  שישית: 6,
  ששית: 6,
  שישי: 6,
  שביעית: 7,
  שביעי: 7,
  שמינית: 8,
  שמיני: 8,
  תשיעית: 9,
  תשיעי: 9,
  עשירית: 10,
  עשירי: 10,
  ground: 0,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
}

const PRIVATE_HOUSE_PATTERNS = [
  /בית\s*פרטי/,
  /פרטי(?![א-ת])/,
  /צמוד\s*קרקע/,
  /דו\s*משפחתי/,
  /וילה/,
  /קוטג'?/,
  /בית\s*קרקע/,
  /private\s*house/i,
]

/** Gate codes, PO boxes and zip codes — removed, never mapped to a field. */
const NOISE_PATTERNS: Array<[RegExp, string]> = [
  [/(?<![א-ת])(?:ת\.\s?ד\.?|ת"ד|תא\s*דואר)\s*\d+/g, "po_box"],
  [/(?<![א-ת])מיקוד\s*\d{5,7}/g, "zip"],
  [/(?<![א-ת])קוד\s*(?:כניסה|שער|לבניין)?\s*\d+\*?#?/g, "gate_code"],
  [/\bcode\s*\d+/gi, "gate_code"],
  [/(?<![א-ת])(?:ד\.\s?נ\.?|ד"נ)\s*[א-ת]+/g, "regional_mail"],
  [/\b\d{7,}\b/g, "long_number"],
]

const FLOOR_LABEL = "(?:קומות|קומה|קומת|קומא|קומ|קונה|קימה|קומה|ק')"
const APARTMENT_LABEL =
  "(?:דירות|דירה|דירת|דירא|דיר|דר'|apt|apartment|flat)"
const ENTRANCE_LABEL = "(?:כניסה|כניסת|כנ'|entrance|ent)"

function toNumberText(raw: string): string {
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value)) return ""
  return String(value)
}

/** `א` -> 1, `יב` -> 12, `טו` -> 15. Returns null when not a numeral. */
export function hebrewLetterToNumber(raw: string): number | null {
  const letters = cleanText(raw).replace(/['"]/g, "")
  if (!letters || letters.length > 2) return null
  let total = 0
  for (const letter of letters) {
    const value = HEBREW_NUMERALS[letter]
    if (value === undefined) return null
    total += value
  }
  return total > 0 && total <= 40 ? total : null
}

function floorWordToNumber(raw: string): number | null {
  const word = cleanText(raw).toLowerCase()
  if (word in FLOOR_WORDS) return FLOOR_WORDS[word]
  return null
}

interface Extraction {
  text: string
  value: string
}

function takeFirst(text: string, pattern: RegExp): Extraction | null {
  pattern.lastIndex = 0
  const match = pattern.exec(text)
  if (!match) return null
  const captured = match.slice(1).find((group) => group !== undefined) ?? ""
  return {
    text: text.slice(0, match.index) + " " + text.slice(match.index + match[0].length),
    value: captured,
  }
}

function extractFloor(text: string): { text: string; floor: string } {
  let working = text

  const groundLabelled = takeFirst(
    working,
    new RegExp(`(?<![א-ת])${FLOOR_LABEL}\\s*[:.\\-]?\\s*(קרקע|כניסה)(?![א-ת])`)
  )
  if (groundLabelled) return { text: groundLabelled.text, floor: "0" }

  const groundAlone = takeFirst(
    working,
    /(?<![א-ת])(?:קומת\s*)?(קרקע)(?![א-ת])|(?:^|\s)(ground)\s*floor/i
  )
  if (groundAlone) return { text: groundAlone.text, floor: "0" }

  const negative = takeFirst(
    working,
    new RegExp(`(?<![א-ת])${FLOOR_LABEL}\\s*[:.\\-]?\\s*(?:מינוס\\s*)?-\\s*(\\d+)`)
  )
  if (negative) return { text: negative.text, floor: `-${toNumberText(negative.value)}` }

  const negativeWord = takeFirst(
    working,
    new RegExp(`(?<![א-ת])${FLOOR_LABEL}\\s*[:.\\-]?\\s*מינוס\\s*(\\d+)`)
  )
  if (negativeWord) {
    return { text: negativeWord.text, floor: `-${toNumberText(negativeWord.value)}` }
  }

  const numeric = takeFirst(
    working,
    new RegExp(`(?<![א-ת])${FLOOR_LABEL}\\s*[:.\\-]?\\s*(\\d+)`)
  )
  if (numeric) return { text: numeric.text, floor: toNumberText(numeric.value) }

  const worded = takeFirst(
    working,
    new RegExp(`(?<![א-ת])${FLOOR_LABEL}\\s*[:.\\-]?\\s*([א-ת]{3,})(?![א-ת])`)
  )
  if (worded) {
    const value = floorWordToNumber(worded.value)
    if (value !== null) return { text: worded.text, floor: String(value) }
  }

  const lettered = takeFirst(
    working,
    new RegExp(`(?<![א-ת])${FLOOR_LABEL}\\s*[:.\\-]?\\s*([א-ת]['"]?[א-ת]?)(?![א-ת])`)
  )
  if (lettered) {
    const value = hebrewLetterToNumber(lettered.value)
    if (value !== null) return { text: lettered.text, floor: String(value) }
  }

  const englishLabelled = takeFirst(
    working,
    /(?:floor|fl)\.?\s*[:\-]?\s*(-?\d+)/i
  )
  if (englishLabelled) {
    return { text: englishLabelled.text, floor: toNumberText(englishLabelled.value) }
  }

  const englishOrdinal = takeFirst(
    working,
    /(\d+)\s*(?:st|nd|rd|th)?\s*floor\b/i
  )
  if (englishOrdinal) {
    return { text: englishOrdinal.text, floor: toNumberText(englishOrdinal.value) }
  }

  const englishWordOrdinal = takeFirst(
    working,
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s*floor\b/i
  )
  if (englishWordOrdinal) {
    const value = floorWordToNumber(englishWordOrdinal.value)
    if (value !== null) return { text: englishWordOrdinal.text, floor: String(value) }
  }

  return { text: working, floor: "" }
}

function extractApartment(text: string): { text: string; apartment: string } {
  const numeric = takeFirst(
    text,
    new RegExp(
      `(?<![א-ת])${APARTMENT_LABEL}\\.?\\s*(?:מספר|מס'?|no\\.?|#)?\\s*[:.\\-]?\\s*(\\d+)`,
      "i"
    )
  )
  if (numeric) return { text: numeric.text, apartment: toNumberText(numeric.value) }

  const lettered = takeFirst(
    text,
    new RegExp(`(?<![א-ת])${APARTMENT_LABEL}\\s*[:.\\-]?\\s*([א-ת])(?![א-ת])`)
  )
  if (lettered) {
    const value = hebrewLetterToNumber(lettered.value)
    if (value !== null) return { text: lettered.text, apartment: String(value) }
  }

  return { text, apartment: "" }
}

function extractEntrance(text: string): { text: string; entrance: string } {
  const lettered = takeFirst(
    text,
    new RegExp(`(?<![א-ת])${ENTRANCE_LABEL}\\.?\\s*[:.\\-]?\\s*([א-ת]|\\d+)(?![א-ת])`, "i")
  )
  if (lettered) return { text: lettered.text, entrance: cleanText(lettered.value) }

  const sided = takeFirst(text, /(?<![א-ת])כניסה\s*(ימנית|שמאלית|אמצעית)(?![א-ת])/)
  if (sided) return { text: sided.text, entrance: cleanText(sided.value) }

  return { text, entrance: "" }
}

function removeNoise(text: string, notes: string[]): string {
  let working = text
  for (const [pattern, note] of NOISE_PATTERNS) {
    if (pattern.test(working)) {
      notes.push(`removed_${note}`)
      working = working.replace(pattern, " ")
    }
    pattern.lastIndex = 0
  }
  const building = takeFirst(
    working,
    /(?<![א-ת])(?:בניין|בנין|בלוק|building|block)\s*[:.\-]?\s*([א-ת0-9a-z]+)/i
  )
  if (building) {
    notes.push(`building_${building.value}`)
    working = building.text
  }
  return working.replace(/\s+/g, " ").trim()
}

/**
 * Orders a bare numeric pair. The operator rule: an apartment number can never
 * be lower than its floor, so the smaller value is the floor.
 */
function orderFloorApartmentPair(a: number, b: number) {
  const floor = Math.min(a, b)
  const apartment = Math.max(a, b)
  return { floor: String(floor), apartment: String(apartment) }
}

function parseBareUnitField(
  text: string,
  current: { floor: string; apartment: string; entrance: string },
  notes: string[]
): {
  floor: string
  apartment: string
  entrance: string
  isPrivateHouse: boolean
  apartmentFromBareNumber: boolean
} {
  const result = { ...current, isPrivateHouse: false, apartmentFromBareNumber: false }
  const trimmed = cleanText(text)
  if (!trimmed) return result

  const pair = trimmed.match(/^(\d{1,3})\s*[\/\-\s,]\s*(\d{1,3})$/)
  if (pair && !result.floor && !result.apartment) {
    const first = Number.parseInt(pair[1], 10)
    const second = Number.parseInt(pair[2], 10)
    const ordered = orderFloorApartmentPair(first, second)
    if (first > second) notes.push("pair_reordered_floor_lower")
    return { ...result, ...ordered }
  }

  const single = trimmed.match(/^(\d{1,4})$/)
  if (single) {
    const value = Number.parseInt(single[1], 10)
    if (value === 0) {
      if (!result.floor && !result.apartment) {
        notes.push("zero_means_private_house")
        return { ...result, isPrivateHouse: true }
      }
      return result
    }
    if (!result.apartment) {
      notes.push("bare_number_treated_as_apartment")
      return { ...result, apartment: String(value), apartmentFromBareNumber: true }
    }
    // `3 דירה 9`: apartment was labeled, the remaining number is the floor.
    if (!result.floor && value <= 60) {
      notes.push("remaining_number_treated_as_floor")
      return { ...result, floor: String(value) }
    }
    return result
  }

  const numberThenLetter = trimmed.match(/^(\d{1,4})\s*([א-ת])$/)
  if (numberThenLetter) {
    const next = { ...result }
    if (!next.apartment) {
      next.apartment = toNumberText(numberThenLetter[1])
      next.apartmentFromBareNumber = true
    }
    if (!next.entrance) next.entrance = numberThenLetter[2]
    notes.push("number_letter_treated_as_apartment_entrance")
    return next
  }

  const letterOnly = trimmed.match(/^([א-ת])$/)
  if (letterOnly && !result.entrance) {
    notes.push("letter_treated_as_entrance")
    return { ...result, entrance: letterOnly[1] }
  }

  return result
}

/** `14/37` inside a street line means house 14, apartment 37. */
function extractHouseAndApartmentSlash(
  text: string,
  apartment: string
): { text: string; houseNumber: string; apartment: string } {
  const match = text.match(/(?<![\d\/])(\d{1,4})\s*\/\s*(\d{1,4})(?![\d\/])/)
  if (!match) return { text, houseNumber: "", apartment }
  const house = toNumberText(match[1])
  const apt = apartment || toNumberText(match[2])
  const stripped =
    text.slice(0, match.index ?? 0) +
    " " +
    text.slice((match.index ?? 0) + match[0].length)
  return { text: stripped.replace(/\s+/g, " ").trim(), houseNumber: house, apartment: apt }
}

export function parseAddressUnits(
  fullStreet: unknown,
  apartmentFloor: unknown = ""
): UnitParseResult {
  const notes: string[] = []
  let street = cleanText(fullStreet)
  let units = cleanText(apartmentFloor)

  street = removeNoise(street, notes)
  units = removeNoise(units, notes)

  let isPrivateHouse = false
  for (const pattern of PRIVATE_HOUSE_PATTERNS) {
    if (pattern.test(units)) {
      isPrivateHouse = true
      units = units.replace(pattern, " ").trim()
    }
    if (pattern.test(street) && pattern.source.includes("פרטי")) {
      isPrivateHouse = true
      street = street.replace(pattern, " ").trim()
    }
  }

  const unitsEntrance = extractEntrance(units)
  const unitsFloor = extractFloor(unitsEntrance.text)
  const unitsApartment = extractApartment(unitsFloor.text)

  const streetEntrance = extractEntrance(street)
  const streetFloor = extractFloor(streetEntrance.text)
  const streetApartment = extractApartment(streetFloor.text)

  let floor = unitsFloor.floor || streetFloor.floor
  let apartment = unitsApartment.apartment || streetApartment.apartment
  let entrance = unitsEntrance.entrance || streetEntrance.entrance

  const slash = extractHouseAndApartmentSlash(streetApartment.text, apartment)
  apartment = slash.apartment

  const bare = parseBareUnitField(
    unitsApartment.text,
    { floor, apartment, entrance },
    notes
  )
  floor = bare.floor
  apartment = bare.apartment
  entrance = bare.entrance
  if (bare.isPrivateHouse) isPrivateHouse = true

  if (!floor && !apartment && !units && !isPrivateHouse) {
    // No unit information at all — treated as a private house downstream.
    isPrivateHouse = true
  }

  if (isPrivateHouse && (floor || apartment)) isPrivateHouse = false

  return {
    floor,
    apartment,
    entrance,
    houseNumber: slash.houseNumber,
    apartmentFromBareNumber: bare.apartmentFromBareNumber,
    isPrivateHouse,
    streetText: slash.text,
    notes,
  }
}
