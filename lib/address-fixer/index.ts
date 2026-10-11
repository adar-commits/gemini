/**
 * AI Address Fixer — deterministic city / street / unit normalization.
 *
 * `fixAddress` never throws. Any internal failure returns the caller's input
 * (cleaned) with `ok: false` so downstream automations keep running.
 */

import { cleanText, isStreetPrefixWord, tokens as keyTokens } from "./normalize"
import { isFallbackEnabled, withAddressFallback } from "./fallback"
import { parseAddressUnits } from "./parse-units"
import {
  matchCity,
  matchStreetFast,
  matchStreetSlow,
  settlementStreet,
} from "./match"
import { getAddressIndex, getSnapshotIndex, type AddressIndex, type CityEntry, type StreetEntry } from "./street-index"
import { stripLatinNoiseWords } from "./transliterate"

export interface AddressFixerInput {
  city?: unknown
  full_street?: unknown
  apartment_floor?: unknown
}

export interface AddressFixerOutput {
  ok: boolean
  city: string
  city_code: number | null
  city_matched: boolean
  street: string
  street_code: number | null
  street_matched: boolean
  street_no: string
  entrance: string
  floor: string
  apartment: string
  is_private_house: boolean
  confidence: number
  match_tier: string
  notes: string[]
  original: { city: string; full_street: string; apartment_floor: string }
}

/** Settlements small enough that "street = settlement name" is the gov convention. */
const SETTLEMENT_MAX_STREETS = 40
const NUMBER_TOKEN = /^(\d{1,4})([א-תa-z])?$/i
const MAX_WINDOW = 5

interface StreetToken {
  text: string
  number: string | null
  suffix: string
}

function splitStreetTokens(text: string): StreetToken[] {
  return cleanText(text)
    .replace(/[,;|]/g, " ")
    .replace(/(?<=[א-תa-z'"])-(?=[א-תa-z])/gi, " ")
    .split(" ")
    .map((raw) => raw.replace(/^[().\-:#]+|[().\-:#]+$/g, ""))
    .filter(Boolean)
    .map((text) => {
      const match = text.match(NUMBER_TOKEN)
      if (!match) return { text, number: null, suffix: "" }
      return { text, number: String(Number.parseInt(match[1], 10)), suffix: match[2] ?? "" }
    })
}

interface WindowPick {
  start: number
  end: number
  entry: StreetEntry
  confidence: number
  tier: string
}

function nameRuns(list: StreetToken[]): Array<[number, number]> {
  const runs: Array<[number, number]> = []
  let start = -1
  list.forEach((token, index) => {
    if (token.number === null) {
      if (start < 0) start = index
    } else if (start >= 0) {
      runs.push([start, index])
      start = -1
    }
  })
  if (start >= 0) runs.push([start, list.length])
  return runs
}

function isNameWord(token: StreetToken | undefined) {
  return Boolean(
    token &&
      token.number === null &&
      /[א-תa-z]{2,}/i.test(token.text) &&
      !isStreetPrefixWord(token.text)
  )
}

/** True when the window has an unused multi-letter name word right beside it. */
function hasAdjacentNameWord(list: StreetToken[], start: number, end: number) {
  return isNameWord(list[start - 1]) || isNameWord(list[end])
}

function pickStreetWindow(list: StreetToken[], city: CityEntry): WindowPick | null {
  let best: WindowPick | null = null
  const consider = (start: number, end: number, slow: boolean) => {
    const phrase = list.slice(start, end).map((token) => token.text).join(" ")
    const hit = slow ? matchStreetSlow(phrase, city) : matchStreetFast(phrase, city)
    if (!hit) return
    // In a real city the "settlement" street (code 9000, named after the city)
    // only appears because the customer repeated the city name.
    if (hit.entry.code === 9000 && city.rawStreets.length > SETTLEMENT_MAX_STREETS) return
    const hasNumber = list.slice(start, end).some((token) => token.number !== null)
    // A number may only be part of the street name when the gov name itself
    // carries it (`רח 200`) — otherwise it is the house number.
    if (hasNumber && hit.tier !== "street_exact" && hit.tier !== "street_relaxed") return
    // A window that skips other name words next to it (`יגאל אלון` -> `אלון`)
    // may only stand if it is an exact name; fuzzy tiers on a fragment pick
    // unrelated streets (`האלון`).
    if (hasAdjacentNameWord(list, start, end) && hit.tier !== "street_exact" && hit.tier !== "street_relaxed") return
    const score = hit.confidence + (end - start) * 0.01
    const bestScore = best ? best.confidence + (best.end - best.start) * 0.01 : -1
    if (score > bestScore) {
      best = { start, end, entry: hit.entry, confidence: hit.confidence, tier: hit.tier }
    }
  }

  // Windows made of name tokens only, then windows that include a number
  // (gov has streets like `רח 200`).
  for (let start = 0; start < list.length; start += 1) {
    for (let end = start + 1; end <= Math.min(list.length, start + MAX_WINDOW); end += 1) {
      const slice = list.slice(start, end)
      const hasNumber = slice.some((token) => token.number !== null)
      if (hasNumber && slice.every((token) => token.number !== null)) continue
      if (hasNumber && slice.length < 2) continue
      consider(start, end, false)
    }
  }
  if (best) return best

  for (const [start, end] of nameRuns(list)) {
    if (end - start > MAX_WINDOW + 1) continue
    consider(start, end, true)
  }
  return best
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function emptyOutput(input: AddressFixerInput): AddressFixerOutput {
  const city = cleanText(input.city)
  const fullStreet = cleanText(input.full_street)
  const units = cleanText(input.apartment_floor)
  return {
    ok: false,
    city,
    city_code: null,
    city_matched: false,
    street: fullStreet,
    street_code: null,
    street_matched: false,
    street_no: "",
    entrance: "",
    floor: "",
    apartment: "",
    is_private_house: false,
    confidence: 0,
    match_tier: "fallback",
    notes: [],
    original: { city, full_street: fullStreet, apartment_floor: units },
  }
}

/** Removes the city name only where its full word sequence appears. */
function removeCitySequence(list: StreetToken[], cityWords: string[]): StreetToken[] | null {
  if (!cityWords.length) return null
  const keys = list.map((token) => keyTokens(token.text).join(" "))
  for (let start = 0; start + cityWords.length <= list.length; start += 1) {
    const matches = cityWords.every((word, offset) => keys[start + offset] === word)
    if (!matches) continue
    const remaining = [...list.slice(0, start), ...list.slice(start + cityWords.length)]
    if (remaining.some((token) => token.number === null)) return remaining
    return null
  }
  return null
}

function resolveAddress(
  input: AddressFixerInput,
  index: AddressIndex
): AddressFixerOutput {
  const output = emptyOutput(input)
  const notes: string[] = []

  const units = parseAddressUnits(input.full_street, input.apartment_floor)
  notes.push(...units.notes)

  const city = matchCity(input.city, index)
  output.city = city.name
  output.city_code = city.city?.code ?? null
  output.city_matched = city.matched
  if (!city.matched && output.city) notes.push("city_not_found")

  const cityWords = new Set(keyTokens(city.city?.name ?? ""))
  let list = splitStreetTokens(stripLatinNoiseWords(units.streetText))

  // Drop the city name when the customer repeated it inside the street line
  // (`הכרכום חצב 450`), unless it is the whole line (kibbutz / moshav).
  const cityNameVariants: string[][] = []
  for (const name of [city.city?.name, cleanText(input.city)]) {
    const words = keyTokens(name ?? "")
    if (!words.length) continue
    cityNameVariants.push(words)
    // `תל אביב` inside the street line of city `תל אביב - יפו`.
    if (words.length >= 3) cityNameVariants.push(words.slice(0, 2))
  }
  for (const words of cityNameVariants) {
    const withoutCity = removeCitySequence(list, words)
    if (withoutCity) {
      notes.push("removed_city_from_street")
      list = withoutCity
      break
    }
  }

  let pick: WindowPick | null = city.city ? pickStreetWindow(list, city.city) : null

  if (!pick && city.city) {
    const nameTokens = list.filter((token) => token.number === null)
    const leftover = nameTokens.filter(
      (token) => !cityWords.has(keyTokens(token.text)[0] ?? "") && !/^(קיבוץ|מושב|כפר|kibbutz|moshav)$/i.test(token.text)
    )
    const small = city.city.rawStreets.length <= SETTLEMENT_MAX_STREETS
    const settlement = leftover.length === 0 && small ? settlementStreet(city.city) : null
    if (settlement) {
      notes.push("street_defaulted_to_settlement")
      pick = {
        start: list.length,
        end: list.length,
        entry: settlement,
        confidence: 0.75,
        tier: "street_settlement",
      }
    }
  }

  let houseToken: StreetToken | null = null
  if (pick) {
    houseToken =
      list.slice(pick.end).find((token) => token.number !== null) ??
      [...list.slice(0, pick.start)].reverse().find((token) => token.number !== null) ??
      null
    output.street = pick.entry.name
    output.street_code = pick.entry.code
    output.street_matched = true
  } else {
    houseToken = list.find((token) => token.number !== null) ?? null
    output.street = list
      .filter((token) => token.number === null)
      .map((token) => token.text)
      .join(" ")
    if (output.street) notes.push("street_not_found")
  }

  output.street_no = units.houseNumber || houseToken?.number || ""
  let entrance = units.entrance
  if (houseToken?.suffix && !units.houseNumber) {
    if (!entrance && /[א-ת]/.test(houseToken.suffix)) {
      entrance = houseToken.suffix
      notes.push("house_letter_treated_as_entrance")
    }
  }

  const extraNumbers = list.filter(
    (token) =>
      token.number !== null &&
      token !== houseToken &&
      !(pick && list.indexOf(token) >= pick.start && list.indexOf(token) < pick.end)
  )
  if (extraNumbers.length) {
    notes.push(`ignored_numbers_${extraNumbers.map((token) => token.text).join("_")}`)
  }

  output.entrance = entrance
  output.floor = units.floor
  output.apartment = units.apartment
  output.is_private_house = units.isPrivateHouse

  // `אריה לייב יפה` + units `36 ג`: with no house number in the street line,
  // the lone unlabeled number in the units field is the house number.
  if (!output.street_no && units.apartmentFromBareNumber && !units.floor) {
    output.street_no = units.apartment
    output.apartment = ""
    output.is_private_house = true
    notes.push("bare_unit_number_used_as_house_number")
  }

  if (city.matched && output.street_matched) {
    output.confidence = round(Math.min(city.confidence, pick?.confidence ?? 0))
    output.match_tier = `${city.tier}+${pick?.tier ?? "none"}`
  } else if (city.matched) {
    output.confidence = 0.4
    output.match_tier = `${city.tier}+street_none`
  } else {
    output.confidence = 0.1
    output.match_tier = "city_none"
  }

  output.ok = true
  output.notes = notes
  return output
}

function hasNameWords(value: unknown) {
  return /[א-תa-z]{2,}/i.test(cleanText(value))
}

export function fixAddressWithIndex(
  input: AddressFixerInput,
  index: AddressIndex
): AddressFixerOutput {
  const primary = resolveAddress(input, index)
  const weak = !primary.street_matched || primary.match_tier.endsWith("street_settlement")
  if (!weak || !primary.city_matched || !hasNameWords(input.apartment_floor)) return primary

  // The street was typed into the units field (`8` + `8 צאלים`): read both
  // lines together and keep that reading only if it finds a real street.
  const combined = resolveAddress(
    {
      city: input.city,
      full_street: `${cleanText(input.full_street)} ${cleanText(input.apartment_floor)}`,
      apartment_floor: "",
    },
    index
  )
  if (!combined.street_matched || combined.match_tier.endsWith("street_settlement")) {
    return primary
  }
  combined.original = primary.original
  combined.notes.push("street_found_in_units_field")
  return combined
}

export async function fixAddress(input: AddressFixerInput): Promise<AddressFixerOutput> {
  try {
    const index = await getAddressIndex()
    const primary = fixAddressWithIndex(input, index)
    if (!isFallbackEnabled()) return primary
    return await withAddressFallback(input, primary, index)
  } catch (error) {
    try {
      return fixAddressWithIndex(input, getSnapshotIndex())
    } catch {
      const fallback = emptyOutput(input)
      fallback.notes.push(
        `internal_error_${error instanceof Error ? error.message.slice(0, 80) : "unknown"}`
      )
      return fallback
    }
  }
}
