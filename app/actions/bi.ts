"use server"

import { getSupabase } from "@/lib/supabase"

const RECEIPTS_PAGE_SIZE = 20
const THIRTY_DAYS_AGO = new Date()
THIRTY_DAYS_AGO.setDate(THIRTY_DAYS_AGO.getDate() - 30)

export type KPIs = {
  totalRevenue: number
  avgTransactionValue: number
  transactionCount: number
}

export type DailyRevenuePoint = {
  date: string
  revenue: number
}

export type BIFilters = {
  dateFrom?: string
  dateTo?: string
  ivType?: string
  sortBy?: "date" | "total_price"
  sortOrder?: "asc" | "desc"
  page?: number
}

export type BIDataResult = {
  kpis: KPIs
  dailyRevenue: DailyRevenuePoint[]
  receipts: Array<{
    id: string
    iv_num: string | null
    iv_datetime: string | null
    iv_type: string | null
    cust_name: string | null
    branch_name: string | null
    status: string | null
    total_price: number | null
  }>
  totalReceipts: number
  error?: string
}

function toDateOnly(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return null
  }
}

export async function getBIData(filters: BIFilters = {}): Promise<BIDataResult> {
  try {
    const supabase = getSupabase()
    const {
      dateFrom,
      dateTo,
      ivType,
      sortBy = "date",
      sortOrder = "desc",
      page = 1,
    } = filters

    const from = (page - 1) * RECEIPTS_PAGE_SIZE
    const to = from + RECEIPTS_PAGE_SIZE - 1

    const receiptsQuery = supabase
      .from("receipts")
      .select("id, iv_num, iv_datetime, iv_type, cust_name, branch_name, status, total_price", {
        count: "exact",
      })

    if (dateFrom) {
      receiptsQuery.gte("iv_datetime", `${dateFrom}T00:00:00.000Z`)
    }
    if (dateTo) {
      receiptsQuery.lte("iv_datetime", `${dateTo}T23:59:59.999Z`)
    }
    if (ivType?.trim()) {
      receiptsQuery.eq("iv_type", ivType.trim())
    }

    const sortColumn = sortBy === "total_price" ? "total_price" : "iv_datetime"
    receiptsQuery.order(sortColumn, { ascending: sortOrder === "asc", nullsFirst: false })

    const [receiptsResult, kpisResult, dailyResult] = await Promise.all([
      receiptsQuery.range(from, to),
      supabase.from("receipts").select("total_price"),
      supabase
        .from("receipts")
        .select("total_price, iv_datetime")
        .gte("iv_datetime", THIRTY_DAYS_AGO.toISOString()),
    ])

    const { data: receiptsPage, count: totalReceipts, error: receiptsError } = receiptsResult
    if (receiptsError) {
      return {
        kpis: { totalRevenue: 0, avgTransactionValue: 0, transactionCount: 0 },
        dailyRevenue: [],
        receipts: [],
        totalReceipts: 0,
        error: receiptsError.message,
      }
    }

    const kpisRows = (kpisResult.data ?? []) as Array<{ total_price: number | null }>
    const dailyRows = (dailyResult.data ?? []) as Array<{
      total_price: number | null
      iv_datetime: string | null
    }>

    const totalRevenue = kpisRows.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0)
    const transactionCount = kpisRows.length
    const avgTransactionValue = transactionCount > 0 ? totalRevenue / transactionCount : 0

    const byDay = new Map<string, number>()
    for (const r of dailyRows) {
      const d = toDateOnly(r.iv_datetime)
      if (d) {
        byDay.set(d, (byDay.get(d) ?? 0) + (Number(r.total_price) || 0))
      }
    }
    const dailyRevenue: DailyRevenuePoint[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      dailyRevenue.push({ date: dateStr, revenue: byDay.get(dateStr) ?? 0 })
    }

    return {
      kpis: { totalRevenue, avgTransactionValue, transactionCount },
      dailyRevenue,
      receipts: (receiptsPage ?? []).map((r) => ({
        id: r.id,
        iv_num: r.iv_num,
        iv_datetime: r.iv_datetime,
        iv_type: r.iv_type,
        cust_name: r.cust_name,
        branch_name: r.branch_name,
        status: r.status,
        total_price: r.total_price,
      })),
      totalReceipts: totalReceipts ?? 0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load BI data"
    return {
      kpis: { totalRevenue: 0, avgTransactionValue: 0, transactionCount: 0 },
      dailyRevenue: [],
      receipts: [],
      totalReceipts: 0,
      error: message,
    }
  }
}

export async function getReceiptTypes(): Promise<string[]> {
  try {
    const supabase = getSupabase()
    const { data } = await supabase.from("receipts").select("iv_type").not("iv_type", "is", null)
    const set = new Set<string>()
    for (const row of data ?? []) {
      if (row.iv_type?.trim()) set.add(row.iv_type.trim())
    }
    return Array.from(set).sort()
  } catch {
    return []
  }
}
