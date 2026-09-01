import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"
import { normalizePhoneForOrderApi } from "@/lib/agents/phone-for-api"

const CACHE_TTL_MS = 15 * 60 * 1000

type CacheEntry = {
  orders: OrderShipmentStatus[]
  at: number
}

const ordersByPhone = new Map<string, CacheEntry>()

function cacheKey(phone: string) {
  return normalizePhoneForOrderApi(phone)
}

/** Remember getOrders result — reuse on order confirmation without a second n8n call. */
export function rememberOrdersLookup(phone: string, orders: OrderShipmentStatus[]) {
  const key = cacheKey(phone)
  if (!key) return
  ordersByPhone.set(key, { orders, at: Date.now() })
}

export function recallOrdersLookup(phone: string): OrderShipmentStatus[] | null {
  const key = cacheKey(phone)
  if (!key) return null
  const entry = ordersByPhone.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    ordersByPhone.delete(key)
    return null
  }
  return entry.orders
}

export function clearOrdersLookupCache(phone?: string) {
  if (phone) {
    ordersByPhone.delete(cacheKey(phone))
    return
  }
  ordersByPhone.clear()
}
