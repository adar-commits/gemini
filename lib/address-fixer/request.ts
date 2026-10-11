/**
 * Tolerant request body reading for the address fixer.
 *
 * Callers (n8n, Shopify Flow) often build JSON by string interpolation, so a
 * city like `ג'סר א-זרקא` or a street like `רמב"ם` breaks JSON.parse. This
 * module accepts strict JSON, broken JSON, form bodies and query params.
 */

import type { AddressFixerInput } from "./index"

const FIELD_ALIASES: Record<keyof AddressFixerInput, string[]> = {
  city: ["city", "City", "CITY", "city_name", "cityName", "עיר", "ישוב"],
  full_street: [
    "full_street",
    "fullStreet",
    "FullStreet",
    "full street",
    "street",
    "Street",
    "address",
    "address1",
    "רחוב",
    "כתובת",
  ],
  apartment_floor: [
    "apartment_floor",
    "apartmentFloor",
    "Apartment/Floor",
    "apartment",
    "units",
    "address2",
    "floor_apartment",
    "דירה",
  ],
}

const ALL_KEYS = Object.values(FIELD_ALIASES).flat()

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
}

function pick(source: Record<string, unknown>): AddressFixerInput {
  const result: AddressFixerInput = {}
  for (const field of Object.keys(FIELD_ALIASES) as Array<keyof AddressFixerInput>) {
    for (const alias of FIELD_ALIASES[field]) {
      const value = source[alias]
      if (value !== undefined && value !== null && value !== "") {
        result[field] = typeof value === "object" ? JSON.stringify(value) : value
        break
      }
    }
  }
  return result
}

function hasAnyField(input: AddressFixerInput) {
  return Boolean(input.city || input.full_street || input.apartment_floor)
}

/**
 * Field extraction for JSON that failed to parse. A value runs until the next
 * known key or the closing brace, so unescaped quotes inside it survive.
 */
export function extractFieldsFromBrokenJson(raw: string): AddressFixerInput {
  const keyPattern = ALL_KEYS.map(escapeRegex).join("|")
  const source: Record<string, unknown> = {}
  for (const key of ALL_KEYS) {
    const pattern = new RegExp(
      `["']?${escapeRegex(key)}["']?\\s*:\\s*"([\\s\\S]*?)"\\s*(?=,\\s*["']?(?:${keyPattern})["']?\\s*:|\\s*}\\s*$)`
    )
    const match = raw.match(pattern)
    if (match && source[key] === undefined) {
      source[key] = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    }
  }
  return pick(source)
}

function fromObject(value: unknown): AddressFixerInput | null {
  if (!value || typeof value !== "object") return null
  if (Array.isArray(value)) return fromObject(value[0])
  const record = value as Record<string, unknown>
  const direct = pick(record)
  if (hasAnyField(direct)) return direct
  for (const nested of ["body", "data", "input", "json"]) {
    const inner = fromObject(record[nested])
    if (inner && hasAnyField(inner)) return inner
  }
  return direct
}

export async function readAddressFixerInput(request: Request): Promise<{
  input: AddressFixerInput
  parse: "json" | "json_repaired" | "form" | "query" | "empty"
}> {
  const url = new URL(request.url)
  const query = pick(Object.fromEntries(url.searchParams.entries()))

  let raw = ""
  try {
    raw = await request.text()
  } catch {
    raw = ""
  }
  const trimmed = raw.trim()

  if (trimmed) {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = fromObject(JSON.parse(trimmed))
        if (parsed && hasAnyField(parsed)) return { input: parsed, parse: "json" }
      } catch {
        const repaired = extractFieldsFromBrokenJson(trimmed)
        if (hasAnyField(repaired)) return { input: repaired, parse: "json_repaired" }
      }
    }

    if (trimmed.includes("=")) {
      try {
        const form = pick(Object.fromEntries(new URLSearchParams(trimmed).entries()))
        if (hasAnyField(form)) return { input: form, parse: "form" }
      } catch {
        // fall through to query params
      }
    }
  }

  if (hasAnyField(query)) return { input: query, parse: "query" }
  return { input: {}, parse: "empty" }
}
