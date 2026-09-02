import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"
import { normalizePhoneForOrderApi } from "@/lib/agents/phone-for-api"

const CACHE_TTL_MS = 15 * 60 * 1000

type CacheEntry = {
  orders: OrderShipmentStatus[]
  at: number
}

const ordersByPhone = new Map<string, CacheEntry>()
const ordersByConversation = new Map<
  string,
  CacheEntry & { phone: string }
>()

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

/** Same-thread reuse — survives confirm turn without a second n8n call. */
export function rememberConversationOrdersLookup(
  conversationId: string,
  phone: string,
  orders: OrderShipmentStatus[]
) {
  const key = conversationId.trim()
  const phoneKey = cacheKey(phone)
  if (!key || !phoneKey) return
  rememberOrdersLookup(phone, orders)
  ordersByConversation.set(key, { orders, at: Date.now(), phone: phoneKey })
}

export function recallConversationOrdersLookup(
  conversationId: string,
  phone: string
): OrderShipmentStatus[] | null {
  const key = conversationId.trim()
  const phoneKey = cacheKey(phone)
  if (!key || !phoneKey) return recallOrdersLookup(phone)

  const entry = ordersByConversation.get(key)
  if (!entry) return recallOrdersLookup(phone)
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    ordersByConversation.delete(key)
    return recallOrdersLookup(phone)
  }
  if (entry.phone !== phoneKey) return recallOrdersLookup(phone)
  return entry.orders
}

/** Phone used for the last getOrders in this thread — survives confirm "כן" without re-guessing. */
export function recallConversationLookupPhone(conversationId: string): string | null {
  const key = conversationId.trim()
  if (!key) return null
  const entry = ordersByConversation.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    ordersByConversation.delete(key)
    return null
  }
  return entry.phone
}

/** Reuse orders from this thread on confirm — even if resolveLookupPhone drifted to channel phone. */
export function recallConversationOrdersRelaxed(
  conversationId: string
): OrderShipmentStatus[] | null {
  const key = conversationId.trim()
  if (!key) return null
  const entry = ordersByConversation.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    ordersByConversation.delete(key)
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
  ordersByConversation.clear()
}
