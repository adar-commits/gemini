/**
 * The searchable city / street index.
 *
 * Sources, in order: in-memory cache -> Supabase (only when
 * ADDRESS_FIXER_INDEX_SOURCE=supabase) -> the bundled snapshot. The snapshot
 * is always available, so a database or network outage can never take the
 * address fixer down.
 */

import { gunzipSync } from "node:zlib"
import {
  STREETS_SNAPSHOT_COUNT,
  STREETS_SNAPSHOT_GZIP_BASE64,
  STREETS_SNAPSHOT_VERSION,
} from "./data/streets-snapshot"
import {
  looseKey,
  normalizeKey,
  relaxedKey,
  sortedKey,
  sortedLooseKey,
  withoutStreetPrefix,
} from "./normalize"
import { latinSkeleton } from "./transliterate"
import { fetchStreetRowsFromSupabase, type StreetRow } from "./sync"

export interface StreetEntry {
  code: number
  name: string
  key: string
  relaxed: string
  loose: string
  sorted: string
  sortedLoose: string
  core: string
  skeleton: string
  /** Same, reading every ו as a vowel (`גורדון` -> `grdn`, matching `Gordon`). */
  skeletonVowel: string
}

export interface CityLookups {
  entries: StreetEntry[]
  byKey: Map<string, StreetEntry[]>
  byRelaxed: Map<string, StreetEntry[]>
  byLoose: Map<string, StreetEntry[]>
  bySorted: Map<string, StreetEntry[]>
  bySortedLoose: Map<string, StreetEntry[]>
  byCore: Map<string, StreetEntry[]>
  bySkeleton: Map<string, StreetEntry[]>
}

export interface CityEntry {
  code: number
  name: string
  key: string
  relaxed: string
  loose: string
  sorted: string
  skeleton: string
  rawStreets: Array<[number, string]>
  lookups: CityLookups | null
}

export interface AddressIndex {
  version: string
  source: "snapshot" | "supabase"
  cities: CityEntry[]
  byKey: Map<string, CityEntry[]>
  byRelaxed: Map<string, CityEntry[]>
  byLoose: Map<string, CityEntry[]>
  bySorted: Map<string, CityEntry[]>
  bySkeleton: Map<string, CityEntry[]>
}

interface SnapshotPayload {
  version: string
  count: number
  cities: Array<[number, string, Array<[number, string]>]>
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T) {
  if (!key) return
  const bucket = map.get(key)
  if (bucket) bucket.push(value)
  else map.set(key, [value])
}

function buildIndex(
  cities: Array<[number, string, Array<[number, string]>]>,
  version: string,
  source: "snapshot" | "supabase"
): AddressIndex {
  const index: AddressIndex = {
    version,
    source,
    cities: [],
    byKey: new Map(),
    byRelaxed: new Map(),
    byLoose: new Map(),
    bySorted: new Map(),
    bySkeleton: new Map(),
  }

  for (const [code, name, rawStreets] of cities) {
    const entry: CityEntry = {
      code,
      name,
      key: normalizeKey(name),
      relaxed: relaxedKey(name),
      loose: looseKey(name),
      sorted: sortedKey(name),
      skeleton: latinSkeleton(name),
      rawStreets,
      lookups: null,
    }
    index.cities.push(entry)
    pushTo(index.byKey, entry.key, entry)
    pushTo(index.byRelaxed, entry.relaxed, entry)
    pushTo(index.byLoose, entry.loose, entry)
    pushTo(index.bySorted, entry.sorted, entry)
    pushTo(index.bySkeleton, entry.skeleton, entry)
  }

  return index
}

/** Per-city street lookups are built on first use to keep cold starts cheap. */
export function getCityLookups(city: CityEntry): CityLookups {
  if (city.lookups) return city.lookups

  const lookups: CityLookups = {
    entries: [],
    byKey: new Map(),
    byRelaxed: new Map(),
    byLoose: new Map(),
    bySorted: new Map(),
    bySortedLoose: new Map(),
    byCore: new Map(),
    bySkeleton: new Map(),
  }

  for (const [code, name] of city.rawStreets) {
    const entry: StreetEntry = {
      code,
      name,
      key: normalizeKey(name),
      relaxed: relaxedKey(name),
      loose: looseKey(name),
      sorted: sortedKey(name),
      sortedLoose: sortedLooseKey(name),
      core: withoutStreetPrefix(name),
      skeleton: latinSkeleton(name),
      skeletonVowel: latinSkeleton(name, { vavAsVowel: true }),
    }
    lookups.entries.push(entry)
    pushTo(lookups.byKey, entry.key, entry)
    pushTo(lookups.byRelaxed, entry.relaxed, entry)
    pushTo(lookups.byLoose, entry.loose, entry)
    pushTo(lookups.bySorted, entry.sorted, entry)
    pushTo(lookups.bySortedLoose, entry.sortedLoose, entry)
    pushTo(lookups.byCore, entry.core, entry)
    pushTo(lookups.bySkeleton, entry.skeleton, entry)
    if (entry.skeletonVowel !== entry.skeleton) {
      pushTo(lookups.bySkeleton, entry.skeletonVowel, entry)
    }
  }

  city.lookups = lookups
  return lookups
}

let snapshotIndex: AddressIndex | null = null
let liveIndex: AddressIndex | null = null
let liveLoad: Promise<AddressIndex | null> | null = null

export function getSnapshotIndex(): AddressIndex {
  if (snapshotIndex) return snapshotIndex
  const json = gunzipSync(Buffer.from(STREETS_SNAPSHOT_GZIP_BASE64, "base64")).toString(
    "utf8"
  )
  const payload = JSON.parse(json) as SnapshotPayload
  snapshotIndex = buildIndex(payload.cities, payload.version, "snapshot")
  return snapshotIndex
}

function groupRows(rows: StreetRow[]) {
  const byCity = new Map<number, [number, string, Array<[number, string]>]>()
  for (const row of rows) {
    let city = byCity.get(row.city_code)
    if (!city) {
      city = [row.city_code, row.city_name, []]
      byCity.set(row.city_code, city)
    }
    city[2].push([row.street_code, row.street_name])
  }
  return [...byCity.values()]
}

function useSupabaseIndex() {
  return process.env.ADDRESS_FIXER_INDEX_SOURCE?.trim().toLowerCase() === "supabase"
}

/**
 * Returns the best index available right now. Never throws: any Supabase
 * problem falls back to the bundled snapshot.
 */
export async function getAddressIndex(): Promise<AddressIndex> {
  if (liveIndex) return liveIndex
  if (!useSupabaseIndex()) return getSnapshotIndex()

  if (!liveLoad) {
    liveLoad = (async () => {
      try {
        const rows = await fetchStreetRowsFromSupabase()
        if (rows.length < 1000) return null
        return buildIndex(groupRows(rows), `supabase-${rows.length}`, "supabase")
      } catch {
        return null
      }
    })()
  }

  const loaded = await liveLoad
  if (loaded) {
    liveIndex = loaded
    return loaded
  }
  return getSnapshotIndex()
}

export function snapshotInfo() {
  return { version: STREETS_SNAPSHOT_VERSION, count: STREETS_SNAPSHOT_COUNT }
}

/** Test helper: drops cached indexes so env changes take effect. */
export function resetAddressIndexCache() {
  liveIndex = null
  liveLoad = null
}
