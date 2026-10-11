/**
 * City and street matching against the gov street list.
 *
 * Hard rule: a street is only replaced when a tier is confident. Anything
 * weaker returns the customer's own cleaned text with `matched: false` — the
 * fixer never swaps in a different real street to look successful.
 */

import {
  cleanText,
  editDistance,
  looseKey,
  normalizeKey,
  relaxedKey,
  sortedKey,
  sortedLooseKey,
  withoutStreetPrefix,
} from "./normalize"
import { hasLatinLetters, latinSkeleton } from "./transliterate"
import {
  getCityLookups,
  type AddressIndex,
  type CityEntry,
  type StreetEntry,
} from "./street-index"

/** Spellings the dataset does not carry. Keys are normalized city keys. */
const CITY_ALIASES: Record<string, string> = {
  "תל אביב": "תל אביב - יפו",
  "ת א": "תל אביב - יפו",
  תא: "תל אביב - יפו",
  יפו: "תל אביב - יפו",
  מודיעין: "מודיעין-מכבים-רעות",
  צורן: "קדימה-צורן",
  "זכרון יעקב": "זכרון יעקב",
  "נוף הגליל": "נוף הגליל",
  ראשלצ: "ראשון לציון",
  "ראשון": "ראשון לציון",
  פת: "פתח תקווה",
  בש: "באר שבע",
  "באר-שבע": "באר שבע",
  "יהוד": "יהוד-מונוסון",
  "tel aviv": "תל אביב - יפו",
  "tel aviv yafo": "תל אביב - יפו",
  "tel aviv jaffa": "תל אביב - יפו",
  telaviv: "תל אביב - יפו",
  jerusalem: "ירושלים",
  haifa: "חיפה",
  "rishon lezion": "ראשון לציון",
  "rishon le zion": "ראשון לציון",
  "petah tikva": "פתח תקווה",
  "petach tikva": "פתח תקווה",
  ashdod: "אשדוד",
  netanya: "נתניה",
  "beer sheva": "באר שבע",
  "bnei brak": "בני ברק",
  holon: "חולון",
  "ramat gan": "רמת גן",
  "bat yam": "בת ים",
  ashkelon: "אשקלון",
  rehovot: "רחובות",
  "bat hefer": "בת חפר",
  herzliya: "הרצליה",
  "kfar saba": "כפר סבא",
  "kfar sava": "כפר סבא",
  hadera: "חדרה",
  modiin: "מודיעין-מכבים-רעות",
  "modiin maccabim reut": "מודיעין-מכבים-רעות",
  raanana: "רעננה",
  "ra anana": "רעננה",
  lod: "לוד",
  ramla: "רמלה",
  nahariya: "נהריה",
  "kiryat gat": "קרית גת",
  "kiryat ono": "קרית אונו",
  "qiryat ono": "קרית אונו",
  "kiryat ata": "קרית אתא",
  "kiryat bialik": "קרית ביאליק",
  "kiryat motzkin": "קרית מוצקין",
  "kiryat yam": "קרית ים",
  eilat: "אילת",
  akko: "עכו",
  acre: "עכו",
  tiberias: "טבריה",
  nazareth: "נצרת",
  givatayim: "גבעתיים",
  "hod hasharon": "הוד השרון",
  "ramat hasharon": "רמת השרון",
  "givat shmuel": "גבעת שמואל",
  "rosh haayin": "ראש העין",
  "kochav yair": "כוכב יאיר צור יגאל",
  yehud: "יהוד-מונוסון",
  "yehud monosson": "יהוד-מונוסון",
  "yahud monosson": "יהוד-מונוסון",
  azor: "אזור",
  "beer sheba": "באר שבע",
  "beersheba": "באר שבע",
  "rishon": "ראשון לציון",
  "petah tiqva": "פתח תקווה",
  "ness ziona": "נס ציונה",
  "zichron yaakov": "זכרון יעקב",
  "kiryat tivon": "קרית טבעון",
  "beit shemesh": "בית שמש",
  "maale adumim": "מעלה אדומים",
  "kfar yona": "כפר יונה",
  "even yehuda": "אבן יהודה",
  shoham: "שוהם",
  yavne: "יבנה",
  karmiel: "כרמיאל",
  afula: "עפולה",
  dimona: "דימונה",
  "nes ziona": "נס ציונה",
  "or yehuda": "אור יהודה",
  "ganei tikva": "גני תקווה",
  "tel mond": "תל מונד",
  "pardes hanna": "פרדס חנה-כרכור",
  "pardes hana": "פרדס חנה-כרכור",
}

export interface CityMatchResult {
  city: CityEntry | null
  name: string
  matched: boolean
  confidence: number
  tier: string
}

export interface StreetMatchResult {
  entry: StreetEntry | null
  name: string
  matched: boolean
  confidence: number
  tier: string
}

function unique<T>(list: T[] | undefined): T | null {
  if (!list || list.length !== 1) return null
  return list[0]
}

let normalizedAliases: Map<string, string> | null = null

function aliasTarget(key: string): string | null {
  if (!normalizedAliases) {
    normalizedAliases = new Map()
    for (const [alias, target] of Object.entries(CITY_ALIASES)) {
      normalizedAliases.set(normalizeKey(alias), normalizeKey(target))
    }
  }
  return normalizedAliases.get(key) ?? null
}

function prefixCityMatch(key: string, index: AddressIndex): CityEntry | null {
  if (key.length < 4) return null
  const hits: CityEntry[] = []
  for (const city of index.cities) {
    if (city.key === key || city.key.startsWith(`${key} `)) hits.push(city)
    if (hits.length > 1) return null
  }
  return hits[0] ?? null
}

function fuzzyCity(key: string, index: AddressIndex): { city: CityEntry; distance: number } | null {
  if (key.length < 5) return null
  const max = key.length >= 9 ? 2 : 1
  let best: CityEntry | null = null
  let bestDistance = max + 1
  let tiedCount = 0
  for (const city of index.cities) {
    const distance = editDistance(key, city.relaxed, max)
    if (distance > max) continue
    if (distance < bestDistance) {
      best = city
      bestDistance = distance
      tiedCount = 1
    } else if (distance === bestDistance) {
      tiedCount += 1
    }
  }
  if (!best || tiedCount > 1) return null
  return { city: best, distance: bestDistance }
}

export function matchCity(rawCity: unknown, index: AddressIndex): CityMatchResult {
  const cleaned = cleanText(rawCity)
  const miss: CityMatchResult = {
    city: null,
    name: cleaned,
    matched: false,
    confidence: 0,
    tier: "none",
  }
  const key = normalizeKey(cleaned)
  if (!key) return miss

  const exact = unique(index.byKey.get(key)) ?? index.byKey.get(key)?.[0]
  if (exact) {
    return { city: exact, name: exact.name, matched: true, confidence: 1, tier: "city_exact" }
  }

  const alias = aliasTarget(key)
  if (alias) {
    const target = index.byKey.get(alias)?.[0]
    if (target) {
      return {
        city: target,
        name: target.name,
        matched: true,
        confidence: 0.97,
        tier: "city_alias",
      }
    }
  }

  const relaxed = index.byRelaxed.get(relaxedKey(cleaned))?.[0]
  if (relaxed) {
    return {
      city: relaxed,
      name: relaxed.name,
      matched: true,
      confidence: 0.96,
      tier: "city_relaxed",
    }
  }

  const sorted = unique(index.bySorted.get(sortedKey(cleaned)))
  if (sorted) {
    return {
      city: sorted,
      name: sorted.name,
      matched: true,
      confidence: 0.94,
      tier: "city_sorted",
    }
  }

  const loose = unique(index.byLoose.get(looseKey(cleaned)))
  if (loose) {
    return { city: loose, name: loose.name, matched: true, confidence: 0.93, tier: "city_loose" }
  }

  const prefix = prefixCityMatch(key, index)
  if (prefix) {
    return {
      city: prefix,
      name: prefix.name,
      matched: true,
      confidence: 0.9,
      tier: "city_prefix",
    }
  }

  const skeleton = unique(index.bySkeleton.get(latinSkeleton(cleaned)))
  if (skeleton) {
    return {
      city: skeleton,
      name: skeleton.name,
      matched: true,
      confidence: 0.88,
      tier: "city_skeleton",
    }
  }

  const fuzzy = fuzzyCity(relaxedKey(cleaned), index)
  if (fuzzy) {
    return {
      city: fuzzy.city,
      name: fuzzy.city.name,
      matched: true,
      confidence: fuzzy.distance === 1 ? 0.85 : 0.8,
      tier: `city_fuzzy_${fuzzy.distance}`,
    }
  }

  return miss
}

interface Tier {
  tier: string
  confidence: number
  entry: StreetEntry
}

function subsetMatch(input: string[], entries: StreetEntry[]): StreetEntry | null {
  if (!input.length) return null
  const inputSet = new Set(input)
  const hits: StreetEntry[] = []
  for (const entry of entries) {
    const entryTokens = entry.key.split(" ")
    if (entryTokens.length <= input.length) continue
    const covered = input.every((token) => entryTokens.includes(token))
    if (covered) hits.push(entry)
    if (hits.length > 1) return null
  }
  if (hits.length !== 1) return null
  // Require the shared part to be substantial, not a single generic word.
  const shared = hits[0].key.split(" ").filter((token) => inputSet.has(token))
  const sharedLength = shared.join("").length
  return sharedLength >= 4 ? hits[0] : null
}

/** `דרך מנחם בגין` -> `דרך בגין`: every gov word present, one extra input word. */
function supersetMatch(input: string[], entries: StreetEntry[]): StreetEntry | null {
  if (input.length < 3) return null
  const inputSet = new Set(input)
  let hit: StreetEntry | null = null
  for (const entry of entries) {
    const entryTokens = entry.key.split(" ")
    if (entryTokens.length < 2 || entryTokens.length !== input.length - 1) continue
    if (entryTokens.join("").length < 5) continue
    if (!entryTokens.every((token) => inputSet.has(token))) continue
    if (hit) return null
    hit = entry
  }
  return hit
}

function fuzzyStreet(
  key: string,
  entries: StreetEntry[]
): { entry: StreetEntry; distance: number } | null {
  // Short names are too close to each other (רמב"ם / רמב"ן) to edit-match safely.
  if (key.replace(/ /g, "").length < 5) return null
  // One edit only: two edits on a street name reach real, different streets
  // (מרגלות חברון -> מעלות חברון).
  const max = 1
  let best: StreetEntry | null = null
  let bestDistance = max + 1
  let tied = 0
  for (const entry of entries) {
    const distance = editDistance(key, entry.relaxed, max)
    if (distance > max) continue
    if (distance < bestDistance) {
      best = entry
      bestDistance = distance
      tied = 1
    } else if (distance === bestDistance) {
      tied += 1
    }
  }
  if (!best || tied > 1) return null
  return { entry: best, distance: bestDistance }
}

/** Cheap tiers only — pure map lookups, safe to run for every candidate window. */
export function matchStreetFast(rawStreet: unknown, city: CityEntry): Tier | null {
  const direct = matchStreetFastOnce(rawStreet, city)
  if (direct) return direct
  // `רח' מקס נורדאו`, `השר משה שפירא`: retry without the street-type / title word.
  const key = normalizeKey(rawStreet)
  const core = withoutStreetPrefix(rawStreet)
  if (!core || core === key) return null
  const retry = matchStreetFastOnce(core, city)
  if (!retry) return null
  return {
    ...retry,
    tier: `${retry.tier}_no_prefix`,
    confidence: Math.max(0, retry.confidence - 0.02),
  }
}

function matchStreetFastOnce(rawStreet: unknown, city: CityEntry): Tier | null {
  const cleaned = cleanText(rawStreet)
  const key = normalizeKey(cleaned)
  if (!key) return null
  const lookups = getCityLookups(city)

  const exact = lookups.byKey.get(key)?.[0]
  if (exact) return { tier: "street_exact", confidence: 1, entry: exact }

  const relaxed = lookups.byRelaxed.get(relaxedKey(cleaned))?.[0]
  if (relaxed) return { tier: "street_relaxed", confidence: 0.97, entry: relaxed }

  const core = withoutStreetPrefix(cleaned)
  const byCore = core && core !== key ? lookups.byCore.get(core)?.[0] : null
  if (byCore) return { tier: "street_prefix_free", confidence: 0.95, entry: byCore }
  const coreAsKey = lookups.byCore.get(key)?.[0]
  if (coreAsKey) return { tier: "street_prefix_free", confidence: 0.95, entry: coreAsKey }

  // Definite article: `רמב"ם` vs `הרמב"ם`, `הגפן` vs `גפן`.
  const articleKey = key.startsWith("ה") ? key.slice(1) : `ה${key}`
  if (articleKey.length >= 3) {
    const article =
      unique(lookups.byKey.get(articleKey)) ??
      unique(lookups.byCore.get(articleKey)) ??
      unique(lookups.byRelaxed.get(relaxedKey(articleKey)))
    if (article) return { tier: "street_article", confidence: 0.93, entry: article }
  }

  const sorted = unique(lookups.bySorted.get(sortedKey(cleaned)))
  if (sorted) return { tier: "street_word_order", confidence: 0.94, entry: sorted }

  const loose = unique(lookups.byLoose.get(looseKey(cleaned)))
  if (loose) return { tier: "street_spelling", confidence: 0.9, entry: loose }

  const sortedLoose = unique(lookups.bySortedLoose.get(sortedLooseKey(cleaned)))
  if (sortedLoose) {
    return { tier: "street_word_order_spelling", confidence: 0.88, entry: sortedLoose }
  }

  const skeleton = latinSkeleton(cleaned)
  if (skeleton.length >= 3) {
    const bySkeleton = unique(lookups.bySkeleton.get(skeleton))
    if (bySkeleton) return { tier: "street_translit", confidence: 0.85, entry: bySkeleton }
  }

  return null
}

/** Expensive tiers — only run for the few best candidate windows. */
export function matchStreetSlow(rawStreet: unknown, city: CityEntry): Tier | null {
  const cleaned = cleanText(rawStreet)
  const key = normalizeKey(cleaned)
  if (!key) return null
  const lookups = getCityLookups(city)

  const subset = subsetMatch(key.split(" "), lookups.entries)
  if (subset) return { tier: "street_partial", confidence: 0.84, entry: subset }

  const superset = supersetMatch(key.split(" "), lookups.entries)
  if (superset) return { tier: "street_extra_word", confidence: 0.8, entry: superset }

  const fuzzy = fuzzyStreet(relaxedKey(cleaned), lookups.entries)
  if (fuzzy) {
    return {
      tier: `street_fuzzy_${fuzzy.distance}`,
      confidence: fuzzy.distance === 1 ? 0.82 : 0.75,
      entry: fuzzy.entry,
    }
  }

  // English input only, and the first / last sounds must agree — a free edit
  // there turns `Israel Bak` (srlvk) into `קרליבך` (krlvk).
  const skeleton = hasLatinLetters(cleaned) ? latinSkeleton(cleaned) : ""
  if (skeleton.length >= 5) {
    let best: StreetEntry | null = null
    let bestDistance = 2
    let tied = 0
    const first = skeleton[0]
    const last = skeleton[skeleton.length - 1]
    for (const entry of lookups.entries) {
      if (!entry.skeleton) continue
      const anchored = [entry.skeleton, entry.skeletonVowel].some(
        (value) => value[0] === first && value[value.length - 1] === last
      )
      if (!anchored) continue
      const distance = Math.min(
        editDistance(skeleton, entry.skeleton, 1),
        editDistance(skeleton, entry.skeletonVowel, 1)
      )
      if (distance > 1) continue
      if (distance < bestDistance) {
        best = entry
        bestDistance = distance
        tied = 1
      } else if (distance === bestDistance) {
        tied += 1
      }
    }
    if (best && tied === 1) {
      return { tier: "street_translit_fuzzy", confidence: 0.72, entry: best }
    }
  }

  return null
}

export function matchStreet(rawStreet: unknown, city: CityEntry): StreetMatchResult {
  const cleaned = cleanText(rawStreet)
  const hit = matchStreetFast(cleaned, city) ?? matchStreetSlow(cleaned, city)
  if (!hit) {
    return {
      entry: null,
      name: cleaned,
      matched: false,
      confidence: 0,
      tier: "none",
    }
  }
  return {
    entry: hit.entry,
    name: hit.entry.name,
    matched: true,
    confidence: hit.confidence,
    tier: hit.tier,
  }
}

/** Street entry that stands for "the settlement itself" (gov street code 9000). */
export function settlementStreet(city: CityEntry): StreetEntry | null {
  const lookups = getCityLookups(city)
  const byCode = lookups.entries.find((entry) => entry.code === 9000)
  if (byCode) return byCode
  return lookups.byKey.get(city.key)?.[0] ?? null
}
