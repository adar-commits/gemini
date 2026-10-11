/**
 * Replays the v1.0 AI Address Fixer log through the deterministic fixer.
 *
 *   npx tsx scripts/address-fixer-replay.ts "<path to v1.0 csv>" [--diff 40]
 *
 * v1.0 columns: City, FullStreet, Apartment/Floor | City, Street, StreetNo,
 * Floor, Apartment (the v1.0 sheet headers label the last two the other way
 * round; the values are floor then apartment).
 */

import { readFileSync } from "node:fs"
import { fixAddressWithIndex } from "../lib/address-fixer"
import { normalizeKey } from "../lib/address-fixer/normalize"
import { getSnapshotIndex } from "../lib/address-fixer/street-index"

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else field += char
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function main() {
  const file = process.argv[2]
  if (!file) {
    console.error("Usage: npx tsx scripts/address-fixer-replay.ts <csv> [--diff N]")
    process.exit(1)
  }
  const diffIndex = process.argv.indexOf("--diff")
  const diffLimit = diffIndex > 0 ? Number(process.argv[diffIndex + 1] ?? 40) : 40

  const rows = parseCsv(readFileSync(file, "utf8")).slice(2).filter((row) => row.length >= 3)
  const index = getSnapshotIndex()
  const started = Date.now()

  let cityMatched = 0
  let streetMatched = 0
  let streetNo = 0
  let sameStreetAsV1 = 0
  let errors = 0
  const tiers = new Map<string, number>()
  const diffs: string[] = []
  const unmatched: string[] = []

  for (const row of rows) {
    const [city, fullStreet, units, , v1Street, v1No, v1Floor, v1Apt] = row
    let out
    try {
      out = fixAddressWithIndex({ city, full_street: fullStreet, apartment_floor: units }, index)
    } catch (error) {
      errors += 1
      if (errors < 5) console.error("THROW", row.slice(0, 3), error)
      continue
    }
    if (out.city_matched) cityMatched += 1
    if (out.street_matched) streetMatched += 1
    if (out.street_no) streetNo += 1
    const tier = out.match_tier.split("+")[1] ?? out.match_tier
    tiers.set(tier, (tiers.get(tier) ?? 0) + 1)

    const sameStreet = normalizeKey(out.street) === normalizeKey(v1Street ?? "")
    if (sameStreet) sameStreetAsV1 += 1

    const line = `${JSON.stringify([city, fullStreet, units])}\n    v1: ${v1Street} | ${v1No} | F${v1Floor} A${v1Apt}\n    v2: ${out.street} | ${out.street_no} | F${out.floor} A${out.apartment} E${out.entrance} (${out.confidence} ${out.match_tier})`
    if (!out.street_matched && unmatched.length < diffLimit) unmatched.push(line)
    else if (
      out.street_matched &&
      (!sameStreet || (v1No ?? "").trim() !== out.street_no) &&
      diffs.length < diffLimit
    ) {
      diffs.push(line)
    }
  }

  const total = rows.length
  const pct = (value: number) => `${((value / total) * 100).toFixed(1)}%`
  console.log(`Rows: ${total}  (${Date.now() - started} ms, ${errors} throws)`)
  console.log(`City matched:   ${cityMatched} (${pct(cityMatched)})`)
  console.log(`Street matched: ${streetMatched} (${pct(streetMatched)})`)
  console.log(`House number:   ${streetNo} (${pct(streetNo)})`)
  console.log(`Same street as v1.0: ${sameStreetAsV1} (${pct(sameStreetAsV1)})`)
  console.log("Street tiers:")
  for (const [tier, count] of [...tiers.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier.padEnd(32)} ${count}`)
  }
  console.log(`\n--- Matched but differs from v1.0 (first ${diffs.length}) ---`)
  for (const line of diffs) console.log(line)
  console.log(`\n--- Unmatched streets (first ${unmatched.length}) ---`)
  for (const line of unmatched) console.log(line)
}

main()
