import { createClient } from '@supabase/supabase-js'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      branch_goals: {
        Row: {
          id: string
          created_at: string
          branch_id: string
          branch_name: string
          goal_amount: number
          month: number
          year: number
          created_by: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          branch_id: string
          branch_name: string
          goal_amount?: number
          month: number
          year: number
          created_by?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          branch_id?: string
          branch_name?: string
          goal_amount?: number
          month?: number
          year?: number
          created_by?: string | null
        }
      }
      branch_visitors: {
        Row: {
          id: string
          created_at: string
          date: string
          branch_id: string
          visitor_count: number
        }
        Insert: {
          id?: string
          created_at?: string
          date: string
          branch_id: string
          visitor_count?: number
        }
        Update: {
          id?: string
          created_at?: string
          date?: string
          branch_id?: string
          visitor_count?: number
        }
      }
      branches: {
        Row: {
          id: string
          name: string
          is_active: boolean
        }
        Insert: {
          id: string
          name: string
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          is_active?: boolean
        }
      }
      customer_visits: {
        Row: {
          id: number
          visit_date: string
          branch_id: string | null
          branch_name: string | null
          salesperson_name: string | null
          visit_count: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          visit_date?: string
          branch_id?: string | null
          branch_name?: string | null
          salesperson_name?: string | null
          visit_count?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          visit_date?: string
          branch_id?: string | null
          branch_name?: string | null
          salesperson_name?: string | null
          visit_count?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          cust_id: string
          cust_name: string | null
          creating_user: string | null
          creation_date: string | null
          phone: string | null
          additional_phone: string | null
          email: string | null
          city: string | null
          branch_id: string | null
          branch_name: string | null
          external_shopifycustomer_id: string | null
          merged_into_cust_id: string | null
        }
        Insert: {
          cust_id: string
          cust_name?: string | null
          creating_user?: string | null
          creation_date?: string | null
          phone?: string | null
          additional_phone?: string | null
          email?: string | null
          city?: string | null
          branch_id?: string | null
          branch_name?: string | null
          external_shopifycustomer_id?: string | null
          merged_into_cust_id?: string | null
        }
        Update: {
          cust_id?: string
          cust_name?: string | null
          creating_user?: string | null
          creation_date?: string | null
          phone?: string | null
          additional_phone?: string | null
          email?: string | null
          city?: string | null
          branch_id?: string | null
          branch_name?: string | null
          external_shopifycustomer_id?: string | null
          merged_into_cust_id?: string | null
        }
      }
      deliveries: {
        Row: {
          iv_num: string
          courier_id: string | null
          courier_name: string | null
          deliverytype_id: string | null
          deliverytype_name: string | null
          created_at: string | null
        }
        Insert: {
          iv_num: string
          courier_id?: string | null
          courier_name?: string | null
          deliverytype_id?: string | null
          deliverytype_name?: string | null
          created_at?: string | null
        }
        Update: {
          iv_num?: string
          courier_id?: string | null
          courier_name?: string | null
          deliverytype_id?: string | null
          deliverytype_name?: string | null
          created_at?: string | null
        }
      }
      designer_restricted: {
        Row: {
          agent_code: string
          agent_name: string | null
          added_at: string
        }
        Insert: {
          agent_code: string
          agent_name?: string | null
          added_at?: string
        }
        Update: {
          agent_code?: string
          agent_name?: string | null
          added_at?: string
        }
      }
      invoices_salerows: {
        Row: {
          created_at: string
          iv_datetime: string | null
          iv_num: string | null
          iv_type: string | null
          cust_id: string | null
          cust_name: string | null
          branch_id: string | null
          branch_name: string | null
          status: string | null
          agent_id: string | null
          agent_name: string | null
          salesperson_code: string | null
          salesperson_name: string | null
          sku_line: string | null
          sku: string | null
          qty: number
          total_price: number | null
          reference: string | null
          id: string
          coupon: string | null
          courier_id: string | null
          courier_name: string | null
          deliverytype_id: string | null
          deliverytype_name: string | null
        }
        Insert: {
          created_at?: string
          iv_datetime?: string | null
          iv_num?: string | null
          iv_type?: string | null
          cust_id?: string | null
          cust_name?: string | null
          branch_id?: string | null
          branch_name?: string | null
          status?: string | null
          agent_id?: string | null
          agent_name?: string | null
          salesperson_code?: string | null
          salesperson_name?: string | null
          sku_line?: string | null
          sku?: string | null
          qty?: number
          total_price?: number | null
          reference?: string | null
          id?: string
          coupon?: string | null
          courier_id?: string | null
          courier_name?: string | null
          deliverytype_id?: string | null
          deliverytype_name?: string | null
        }
        Update: {
          created_at?: string
          iv_datetime?: string | null
          iv_num?: string | null
          iv_type?: string | null
          cust_id?: string | null
          cust_name?: string | null
          branch_id?: string | null
          branch_name?: string | null
          status?: string | null
          agent_id?: string | null
          agent_name?: string | null
          salesperson_code?: string | null
          salesperson_name?: string | null
          sku_line?: string | null
          sku?: string | null
          qty?: number
          total_price?: number | null
          reference?: string | null
          id?: string
          coupon?: string | null
          courier_id?: string | null
          courier_name?: string | null
          deliverytype_id?: string | null
          deliverytype_name?: string | null
        }
      }
      nav_items: {
        Row: {
          id: string
          section_id: string
          item_id: string
          label: string
          path: string
          item_order: number
          visible: boolean
          under_construction: boolean
        }
        Insert: {
          id?: string
          section_id: string
          item_id: string
          label: string
          path: string
          item_order?: number
          visible?: boolean
          under_construction?: boolean
        }
        Update: {
          id?: string
          section_id?: string
          item_id?: string
          label?: string
          path?: string
          item_order?: number
          visible?: boolean
          under_construction?: boolean
        }
      }
      nav_sections: {
        Row: {
          id: string
          title: string
          order: number
        }
        Insert: {
          id: string
          title: string
          order?: number
        }
        Update: {
          id?: string
          title?: string
          order?: number
        }
      }
      products: {
        Row: {
          sku: string
          product_title: string
          active: boolean
          creation_date: string
          family_id: string | null
          family_description: string | null
          currency: string
          baseprice_novat: number | null
          baseprice_vat: number | null
          standard_cost_ils: number | null
          price_minimum: number | null
          price_buying: number | null
          material: string | null
          color: string | null
          style: string | null
          fringes: string | null
          shape: string | null
          technique: string | null
          international_size: string | null
          model: string | null
          ooak: boolean
          marketplace_title: string | null
          length: number | null
          width: number | null
          sqm: number | null
        }
        Insert: {
          sku: string
          product_title: string
          active?: boolean
          creation_date?: string
          family_id?: string | null
          family_description?: string | null
          currency?: string
          baseprice_novat?: number | null
          baseprice_vat?: number | null
          standard_cost_ils?: number | null
          price_minimum?: number | null
          price_buying?: number | null
          material?: string | null
          color?: string | null
          style?: string | null
          fringes?: string | null
          shape?: string | null
          technique?: string | null
          international_size?: string | null
          model?: string | null
          ooak?: boolean
          marketplace_title?: string | null
          length?: number | null
          width?: number | null
          sqm?: number | null
        }
        Update: {
          sku?: string
          product_title?: string
          active?: boolean
          creation_date?: string
          family_id?: string | null
          family_description?: string | null
          currency?: string
          baseprice_novat?: number | null
          baseprice_vat?: number | null
          standard_cost_ils?: number | null
          price_minimum?: number | null
          price_buying?: number | null
          material?: string | null
          color?: string | null
          style?: string | null
          fringes?: string | null
          shape?: string | null
          technique?: string | null
          international_size?: string | null
          model?: string | null
          ooak?: boolean
          marketplace_title?: string | null
          length?: number | null
          width?: number | null
          sqm?: number | null
        }
      }
      push_subscriptions: {
        Row: {
          id: number
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
          updated_at?: string
        }
      }
      receipts: {
        Row: {
          id: string
          created_at: string
          iv_datetime: string | null
          iv_num: string | null
          iv_type: string | null
          cust_id: string | null
          cust_name: string | null
          branch_id: string | null
          branch_name: string | null
          status: string | null
          agent_id: string | null
          agent_name: string | null
          salesperson_code: string | null
          salesperson_name: string | null
          total_price: number | null
          reference: string | null
          coupon: string | null
          courier_id: string | null
          courier_name: string | null
          deliverytype_id: string | null
          deliverytype_name: string | null
        }
        Insert: {
          id: string
          created_at?: string
          iv_datetime?: string | null
          iv_num?: string | null
          iv_type?: string | null
          cust_id?: string | null
          cust_name?: string | null
          branch_id?: string | null
          branch_name?: string | null
          status?: string | null
          agent_id?: string | null
          agent_name?: string | null
          salesperson_code?: string | null
          salesperson_name?: string | null
          total_price?: number | null
          reference?: string | null
          coupon?: string | null
          courier_id?: string | null
          courier_name?: string | null
          deliverytype_id?: string | null
          deliverytype_name?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          iv_datetime?: string | null
          iv_num?: string | null
          iv_type?: string | null
          cust_id?: string | null
          cust_name?: string | null
          branch_id?: string | null
          branch_name?: string | null
          status?: string | null
          agent_id?: string | null
          agent_name?: string | null
          salesperson_code?: string | null
          salesperson_name?: string | null
          total_price?: number | null
          reference?: string | null
          coupon?: string | null
          courier_id?: string | null
          courier_name?: string | null
          deliverytype_id?: string | null
          deliverytype_name?: string | null
        }
      }
      sync_status: {
        Row: {
          sync_date: string
          last_synced_at: string
          status: string
          is_locked: boolean
        }
        Insert: {
          sync_date: string
          last_synced_at?: string
          status?: string
          is_locked?: boolean
        }
        Update: {
          sync_date?: string
          last_synced_at?: string
          status?: string
          is_locked?: boolean
        }
      }
      trend_exclusions: {
        Row: {
          sku: string
          note: string | null
          added_at: string
        }
        Insert: {
          sku: string
          note?: string | null
          added_at?: string
        }
        Update: {
          sku?: string
          note?: string | null
          added_at?: string
        }
      }
      user_branches: {
        Row: {
          id: number
          user_id: string | null
          branch_id: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          branch_id: string
        }
        Update: {
          id?: number
          user_id?: string | null
          branch_id?: string
        }
      }
      user_roles: {
        Row: {
          user_id: string
          role: string
          can_export: boolean
        }
        Insert: {
          user_id: string
          role: string
          can_export?: boolean
        }
        Update: {
          user_id?: string
          role?: string
          can_export?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim()) {
    throw new Error(
      "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL in .env.local"
    )
  }
  if (!anonKey?.trim()) {
    throw new Error(
      "Missing Supabase anon key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    )
  }
  return { url, anonKey }
}

let client: ReturnType<typeof createClient<Database>> | null = null

export function getSupabase() {
  if (!client) {
    const { url, anonKey } = getSupabaseConfig()
    client = createClient<Database>(url, anonKey)
  }
  return client
}
