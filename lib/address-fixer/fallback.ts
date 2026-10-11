/**
 * Fallback for addresses the deterministic matcher could not resolve
 * (~5% of traffic): Google Geocoding proposes, the gov street list validates,
 * and Haiku 5.5 picks between real candidates.
 *
 * The model can only answer with a candidate id or "none" — it never writes a
 * street name. House number / floor / apartment always stay from the input.
 */

import { generateText, jsonSchema, Output } from "ai"
import { HAIKU_GATEWAY_MODEL, NO_THINKING_PROVIDER_OPTIONS } from "@/lib/agent-core/model-profiles"
import type { AddressFixerInput, AddressFixerOutput } from "./index"
import { matchCity, matchStreet } from "./match"
import { cleanText, relaxedKey, similarity } from "./normalize"
import { getCityLookups, type AddressIndex, type CityEntry, type StreetEntry } from "./street-index"
import { latinSkeleton } from "./transliterate"

const TOTAL_BUDGET_MS = 8000
const GEOCODE_TIMEOUT_MS = 4000
const MAX_GOV_CANDIDATES = 12
const CACHE_LIMIT = 500

export interface GeocodeHit {
  city: string
  street: string
  streetNumber: string
  formatted: string
  partialMatch: boolean
}

export interface FallbackCandidate {
  id: string
  source: "google" | "gov"
  city: CityEntry
  street: StreetEntry
}

export interface FallbackDeps {
  geocode: (query: string) => Promise<GeocodeHit[]>
  /** Returns a candidate id or "none". Throws on model failure. */
  pick: (prompt: string, ids: string[]) => Promise<string>
}

export function isFallbackEnabled() {
  if (process.env.ADDRESS_FIXER_FALLBACK?.trim() === "0") return false
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim())
}

interface GoogleComponent {
  long_name?: string
  types?: string[]
}

interface GoogleResult {
  address_components?: GoogleComponent[]
  formatted_address?: string
  partial_match?: boolean
}

function component(result: GoogleResult, type: string) {
  return result.address_components?.find((part) => part.types?.includes(type))?.long_name ?? ""
}

export async function googleGeocode(query: string): Promise<GeocodeHit[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (!key || !query) return []
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(query)}&language=iw&region=il&components=country:IL&key=${key}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return []
    const payload = (await response.json()) as { status?: string; results?: GoogleResult[] }
    if (payload.status !== "OK" || !Array.isArray(payload.results)) return []
    return payload.results.slice(0, 3).map((result) => ({
      city: component(result, "locality") || component(result, "administrative_area_level_2"),
      street: component(result, "route"),
      streetNumber: component(result, "street_number"),
      formatted: result.formatted_address ?? "",
      partialMatch: Boolean(result.partial_match),
    }))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

export async function haikuPick(prompt: string, ids: string[]): Promise<string> {
  const result = await generateText({
    model: HAIKU_GATEWAY_MODEL,
    temperature: 0,
    maxOutputTokens: 400,
    providerOptions: NO_THINKING_PROVIDER_OPTIONS,
    system: PICK_RULES,
    messages: [{ role: "user", content: prompt }],
    output: Output.object({
      name: "address_candidate_pick",
      schema: jsonSchema<{ choice: string; reason: string }>({
        type: "object",
        additionalProperties: false,
        required: ["choice", "reason"],
        properties: {
          choice: { type: "string", enum: [...ids, "none"] },
          reason: { type: "string" },
        },
      }),
    }),
  })
  const choice = result.output?.choice
  if (choice === "none" || (choice && ids.includes(choice))) return choice
  throw new Error("address fallback: model returned no valid choice")
}

const PICK_RULES = `You match an Israeli customer's typed delivery address to an official street.
You get the customer's raw input and a numbered list of official (city, street) candidates.
Pick the candidate that is clearly the SAME street the customer meant: a misspelling, another
word order, a missing/extra title or first name (הרב, ד"ר, רחוב, שדרות), Hebrew vs English
transliteration, or a known alternate name.
Answer "none" when no candidate is clearly the same street — a merely similar-looking name, a
different person with the same surname, or a guess is "none". A wrong street is worse than none.
Leaving out a first/middle name or initial is fine (משה שפירא = שפירא חיים משה). Only a
CONFLICTING one means a different street (י"ל גורדון vs א"ד גורדון, רמב"ם vs רמב"ן) — "none".
Never pick a candidate in a different city than the customer wrote, unless the customer's city
is unrecognizable and the street identifies it.
Keep "reason" under 12 words.`

function defaultDeps(): FallbackDeps {
  return { geocode: googleGeocode, pick: haikuPick }
}

function streetCandidatesFromGov(text: string, city: CityEntry): StreetEntry[] {
  const key = relaxedKey(text)
  const skeleton = latinSkeleton(text)
  if (!key && !skeleton) return []
  const scored: Array<{ entry: StreetEntry; score: number }> = []
  for (const entry of getCityLookups(city).entries) {
    const score = Math.max(
      key ? similarity(key, entry.relaxed) : 0,
      skeleton && entry.skeleton ? similarity(skeleton, entry.skeleton) : 0,
      skeleton && entry.skeletonVowel ? similarity(skeleton, entry.skeletonVowel) : 0,
      key && entry.key.split(" ").some((word) => word.length >= 3 && key.includes(word)) ? 0.55 : 0
    )
    if (score >= 0.5) scored.push({ entry, score })
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_GOV_CANDIDATES)
    .map((item) => item.entry)
}

function buildPrompt(input: AddressFixerInput, candidates: FallbackCandidate[], hits: GeocodeHit[]) {
  const lines = [
    `Customer city: ${cleanText(input.city) || "(empty)"}`,
    `Customer street line: ${cleanText(input.full_street) || "(empty)"}`,
    `Customer apartment/floor line: ${cleanText(input.apartment_floor) || "(empty)"}`,
  ]
  if (hits.length) {
    lines.push(`Google Maps understood: ${hits.map((hit) => hit.formatted).join(" | ")}`)
  }
  lines.push("Candidates:")
  for (const candidate of candidates) {
    lines.push(`${candidate.id}: ${candidate.street.name}, ${candidate.city.name} (${candidate.source})`)
  }
  return lines.join("\n")
}

const cache = new Map<string, AddressFixerOutput>()

function cacheKey(input: AddressFixerInput) {
  return [input.city, input.full_street, input.apartment_floor].map(cleanText).join("|")
}

function remember(key: string, value: AddressFixerOutput) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

function applyCandidate(
  primary: AddressFixerOutput,
  candidate: FallbackCandidate,
  tier: string,
  confidence: number
): AddressFixerOutput {
  return {
    ...primary,
    city: candidate.city.name,
    city_code: candidate.city.code,
    city_matched: true,
    street: candidate.street.name,
    street_code: candidate.street.code,
    street_matched: true,
    confidence,
    match_tier: tier,
    notes: [
      ...primary.notes.filter((note) => note !== "street_not_found" && note !== "city_not_found"),
      `fallback_${candidate.source}`,
    ],
  }
}

async function runFallback(
  input: AddressFixerInput,
  primary: AddressFixerOutput,
  index: AddressIndex,
  deps: FallbackDeps
): Promise<AddressFixerOutput> {
  const knownCity = primary.city_matched
    ? index.cities.find((city) => city.code === primary.city_code) ?? null
    : null

  const query = [cleanText(input.full_street), cleanText(input.apartment_floor), cleanText(input.city)]
    .filter(Boolean)
    .join(", ")
  const hits = await deps.geocode(query).catch(() => [] as GeocodeHit[])

  const candidates: FallbackCandidate[] = []
  const seen = new Set<string>()
  const add = (source: FallbackCandidate["source"], city: CityEntry, street: StreetEntry) => {
    const key = `${city.code}:${street.code}`
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({ id: `c${candidates.length + 1}`, source, city, street })
  }

  let strongGoogle: FallbackCandidate | null = null
  for (const hit of hits) {
    if (!hit.street || hit.partialMatch) continue
    const city = matchCity(hit.city, index)
    if (!city.city) continue
    // Google may only change the city when the customer's city was unrecognizable.
    if (knownCity && city.city.code !== knownCity.code) continue
    const street = matchStreet(hit.street, city.city)
    if (!street.entry) continue
    add("google", city.city, street.entry)
    const numberAgrees = !primary.street_no || hit.streetNumber === primary.street_no
    if (!strongGoogle && street.confidence >= 0.9 && numberAgrees) {
      strongGoogle = candidates[candidates.length - 1]
    }
  }

  if (knownCity) {
    const text = primary.street || cleanText(input.full_street)
    for (const street of streetCandidatesFromGov(text, knownCity)) add("gov", knownCity, street)
  }

  if (!candidates.length) return primary

  // null = the model failed; "none" = the model looked and declined.
  let choice: string | null = null
  try {
    choice = await deps.pick(
      buildPrompt(input, candidates, hits),
      candidates.map((candidate) => candidate.id)
    )
  } catch {
    choice = null
  }

  const picked = candidates.find((candidate) => candidate.id === choice) ?? null
  if (picked) {
    if (knownCity && picked.city.code !== knownCity.code) return primary
    const agreesWithGoogle = picked.source === "google" || candidates.some(
      (candidate) => candidate.source === "google" && candidate.street.code === picked.street.code
    )
    return applyCandidate(
      primary,
      picked,
      agreesWithGoogle ? "fallback_google_haiku" : "fallback_haiku_gov",
      agreesWithGoogle ? 0.8 : 0.7
    )
  }

  // Model unavailable: only a strong, number-consistent Google hit stands.
  if (choice === null && strongGoogle) {
    return applyCandidate(primary, strongGoogle, "fallback_google", 0.75)
  }
  return { ...primary, notes: [...primary.notes, "fallback_no_confident_match"] }
}

/**
 * Wraps the primary result. Returns `primary` unchanged when the fallback is
 * disabled, not needed, over budget, or anything at all goes wrong.
 */
export async function withAddressFallback(
  input: AddressFixerInput,
  primary: AddressFixerOutput,
  index: AddressIndex,
  deps: FallbackDeps = defaultDeps()
): Promise<AddressFixerOutput> {
  if (!primary.ok || primary.street_matched) return primary
  if (!primary.street && !/[א-תa-z]{2,}/i.test(cleanText(input.full_street))) return primary

  const key = cacheKey(input)
  const cached = cache.get(key)
  if (cached) return cached

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      runFallback(input, primary, index, deps),
      new Promise<AddressFixerOutput>((resolve) => {
        timer = setTimeout(
          () => resolve({ ...primary, notes: [...primary.notes, "fallback_timeout"] }),
          TOTAL_BUDGET_MS
        )
      }),
    ])
    if (!result.notes.includes("fallback_timeout")) remember(key, result)
    return result
  } catch {
    return primary
  } finally {
    clearTimeout(timer)
  }
}

/** Test helper. */
export function clearFallbackCache() {
  cache.clear()
}
