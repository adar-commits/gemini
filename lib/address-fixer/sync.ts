/**
 * Street list sync: data.gov.il -> Supabase (`il_streets`).
 *
 * The runtime index does not depend on this running: it only keeps the
 * database copy fresh so a new snapshot can be generated, or so an instance
 * configured with ADDRESS_FIXER_INDEX_SOURCE=supabase sees new streets.
 */

import { getAgentSupabase } from "@/lib/agents/supabase"
import { normalizeKey } from "./normalize"

export const GOV_RESOURCE_ID = "9ad3862c-8391-4b2f-84a4-2d4c68625f4b"
const GOV_ENDPOINT = "https://data.gov.il/api/3/action/datastore_search"
const PAGE_SIZE = 20000
const MAX_PAGES = 12
/** The dataset has ~63.5k rows. Anything far below that means a broken fetch. */
const MIN_EXPECTED_ROWS = 55000

export interface StreetRow {
  city_code: number
  city_name: string
  street_code: number
  street_name: string
}

interface GovRecord {
  סמל_ישוב?: number | string
  שם_ישוב?: string
  סמל_רחוב?: number | string
  שם_רחוב?: string
}

function toInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toRow(record: GovRecord): StreetRow | null {
  const cityCode = toInteger(record["סמל_ישוב"])
  const streetCode = toInteger(record["סמל_רחוב"])
  const cityName = typeof record["שם_ישוב"] === "string" ? record["שם_ישוב"].trim() : ""
  const streetName =
    typeof record["שם_רחוב"] === "string" ? record["שם_רחוב"].trim() : ""
  if (cityCode === null || streetCode === null || !cityName || !streetName) return null
  return {
    city_code: cityCode,
    city_name: cityName,
    street_code: streetCode,
    street_name: streetName,
  }
}

export async function fetchStreetRowsFromGov(
  options: { timeoutMs?: number } = {}
): Promise<StreetRow[]> {
  const timeoutMs = options.timeoutMs ?? 60000
  const rows: StreetRow[] = []
  let offset = 0

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = `${GOV_ENDPOINT}?resource_id=${GOV_RESOURCE_ID}&limit=${PAGE_SIZE}&offset=${offset}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let payload: { success?: boolean; result?: { records?: GovRecord[]; total?: number } }
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      })
      if (!response.ok) {
        throw new Error(`data.gov.il responded ${response.status}`)
      }
      payload = (await response.json()) as typeof payload
    } finally {
      clearTimeout(timer)
    }

    const records = payload?.result?.records
    if (!Array.isArray(records) || !records.length) break

    for (const record of records) {
      const row = toRow(record)
      if (row) rows.push(row)
    }

    offset += records.length
    const total = payload?.result?.total
    if (typeof total === "number" && offset >= total) break
  }

  if (rows.length < MIN_EXPECTED_ROWS) {
    throw new Error(
      `data.gov.il returned only ${rows.length} usable rows (expected >= ${MIN_EXPECTED_ROWS}) — keeping existing data`
    )
  }
  return rows
}

export interface SyncResult {
  ok: boolean
  fetched: number
  written: number
  error?: string
}

export async function syncStreetsToSupabase(): Promise<SyncResult> {
  let rows: StreetRow[]
  try {
    rows = await fetchStreetRowsFromGov()
  } catch (error) {
    return {
      ok: false,
      fetched: 0,
      written: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  const supabase = getAgentSupabase()
  const chunkSize = 1000
  let written = 0

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize).map((row) => ({
      ...row,
      city_key: normalizeKey(row.city_name),
      street_key: normalizeKey(row.street_name),
    }))
    const { error } = await supabase
      .from("il_streets")
      .upsert(chunk, { onConflict: "city_code,street_code" })
    if (error) {
      return {
        ok: false,
        fetched: rows.length,
        written,
        error: `${error.message} (after ${written} rows)`,
      }
    }
    written += chunk.length
  }

  return { ok: true, fetched: rows.length, written }
}

export async function fetchStreetRowsFromSupabase(): Promise<StreetRow[]> {
  const supabase = getAgentSupabase()
  const rows: StreetRow[] = []
  const pageSize = 1000

  for (let from = 0; from < 200000; from += pageSize) {
    const { data, error } = await supabase
      .from("il_streets")
      .select("city_code,city_name,street_code,street_name")
      .order("city_code", { ascending: true })
      .order("street_code", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    for (const row of data as StreetRow[]) rows.push(row)
    if (data.length < pageSize) break
  }

  return rows
}
