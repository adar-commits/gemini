-- ============================================================
-- Production schema dump: vsvcrzbwgpehpsmhurij
-- Generated via Supabase Management API (schema only, no data)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branch_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    branch_id text NOT NULL,
    branch_name text NOT NULL,
    goal_amount numeric(12,2) DEFAULT 0 NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    created_by uuid,
    PRIMARY KEY (id),
    CONSTRAINT branch_goals_branch_id_month_year_key UNIQUE (branch_id, month, year)
);

CREATE TABLE IF NOT EXISTS public.branch_visitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    date date NOT NULL,
    branch_id text NOT NULL,
    visitor_count integer DEFAULT 0 NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT branch_visitors_date_branch_id_key UNIQUE (date, branch_id)
);

CREATE TABLE IF NOT EXISTS public.branches (
    id text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customer_visits (
    id bigint DEFAULT nextval('customer_visits_id_seq'::regclass) NOT NULL,
    visit_date date DEFAULT CURRENT_DATE NOT NULL,
    branch_id text,
    branch_name text,
    salesperson_name text,
    visit_count integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customers (
    cust_id text NOT NULL,
    cust_name text,
    creating_user text,
    creation_date timestamp with time zone,
    phone text,
    additional_phone text,
    email text,
    city text,
    branch_id text,
    branch_name text,
    external_shopifycustomer_id text,
    merged_into_cust_id text,
    PRIMARY KEY (cust_id)
);

CREATE TABLE IF NOT EXISTS public.deliveries (
    iv_num text NOT NULL,
    courier_id text,
    courier_name text,
    deliverytype_id text,
    deliverytype_name text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT deliveries_inv_num_unique UNIQUE (iv_num)
);

CREATE TABLE IF NOT EXISTS public.designer_restricted (
    agent_code text NOT NULL,
    agent_name text,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (agent_code)
);

CREATE TABLE IF NOT EXISTS public.invoices_salerows (
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    iv_datetime timestamp with time zone,
    iv_num text,
    iv_type text,
    cust_id text,
    cust_name text,
    branch_id text,
    branch_name text,
    status text,
    agent_id text,
    agent_name text,
    salesperson_code text,
    salesperson_name text,
    sku_line text,
    sku text,
    qty integer DEFAULT 1,
    total_price numeric,
    reference text,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coupon text,
    courier_id text,
    courier_name text,
    deliverytype_id text,
    deliverytype_name text,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.nav_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id text NOT NULL,
    item_id text NOT NULL,
    label text NOT NULL,
    path text NOT NULL,
    item_order integer DEFAULT 0 NOT NULL,
    visible boolean DEFAULT true NOT NULL,
    under_construction boolean DEFAULT false NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT nav_items_section_id_item_id_key UNIQUE (section_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.nav_sections (
    id text NOT NULL,
    title text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.products (
    sku text NOT NULL,
    product_title text NOT NULL,
    active boolean DEFAULT true,
    creation_date timestamp with time zone DEFAULT timezone('utc'::text, now()),
    family_id text,
    family_description text,
    currency text DEFAULT 'ILS'::text,
    baseprice_novat numeric(12,2),
    baseprice_vat numeric(12,2),
    standard_cost_ils numeric(12,2),
    price_minimum numeric(12,2),
    price_buying numeric(12,2),
    material text,
    color text,
    style text,
    fringes text,
    shape text,
    technique text,
    international_size text,
    model text,
    ooak boolean DEFAULT false,
    marketplace_title text,
    length numeric(10,2),
    width numeric(10,2),
    sqm numeric(10,3),
    PRIMARY KEY (sku)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id bigint DEFAULT nextval('push_subscriptions_id_seq'::regclass) NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE TABLE IF NOT EXISTS public.receipts (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    iv_datetime timestamp with time zone,
    iv_num text,
    iv_type text,
    cust_id text,
    cust_name text,
    branch_id text,
    branch_name text,
    status text,
    agent_id text,
    agent_name text,
    salesperson_code text,
    salesperson_name text,
    total_price numeric,
    reference text,
    coupon text,
    courier_id text,
    courier_name text,
    deliverytype_id text,
    deliverytype_name text,
    PRIMARY KEY (id),
    CONSTRAINT receipts_iv_num_unique UNIQUE (iv_num)
);

CREATE TABLE IF NOT EXISTS public.sync_status (
    sync_date date NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending'::text,
    is_locked boolean DEFAULT false,
    PRIMARY KEY (sync_date)
);

CREATE TABLE IF NOT EXISTS public.trend_exclusions (
    sku text NOT NULL,
    note text,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (sku)
);

CREATE TABLE IF NOT EXISTS public.user_branches (
    id integer DEFAULT nextval('user_branches_id_seq'::regclass) NOT NULL,
    user_id uuid,
    branch_id text NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id uuid NOT NULL,
    role text NOT NULL,
    can_export boolean DEFAULT true NOT NULL,
    PRIMARY KEY (user_id)
);

-- Foreign Keys
ALTER TABLE public.customers ADD CONSTRAINT customers_merged_into_cust_id_fkey FOREIGN KEY (merged_into_cust_id) REFERENCES public.customers(cust_id);
ALTER TABLE public.nav_items ADD CONSTRAINT nav_items_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.nav_sections(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX customer_visits_branch_id_idx ON public.customer_visits USING btree (branch_id);
CREATE INDEX customer_visits_visit_date_idx ON public.customer_visits USING btree (visit_date);
CREATE INDEX idx_customers_merged_into ON public.customers USING btree (merged_into_cust_id) WHERE (merged_into_cust_id IS NOT NULL);
CREATE INDEX idx_deliveries_courier_id ON public.deliveries USING btree (courier_id);
CREATE INDEX idx_deliveries_inv_num ON public.deliveries USING btree (iv_num);
CREATE UNIQUE INDEX idx_invoices_salerows_unique_key ON public.invoices_salerows USING btree (iv_num, sku, sku_line) NULLS NOT DISTINCT;
CREATE INDEX idx_salerows_branch ON public.invoices_salerows USING btree (branch_name);
CREATE INDEX idx_salerows_datetime ON public.invoices_salerows USING btree (iv_datetime);
CREATE INDEX idx_salerows_datetime_ivtype ON public.invoices_salerows USING btree (iv_datetime, iv_type);
CREATE INDEX idx_salerows_iv_num ON public.invoices_salerows USING btree (iv_num);
CREATE INDEX idx_salerows_ivtype ON public.invoices_salerows USING btree (iv_type);
CREATE INDEX idx_salerows_sku ON public.invoices_salerows USING btree (sku);
CREATE INDEX idx_nav_items_section_visible ON public.nav_items USING btree (section_id, visible);
CREATE INDEX idx_products_family_id ON public.products USING btree (family_id);
CREATE INDEX idx_products_product_title ON public.products USING btree (product_title);
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);
CREATE INDEX idx_receipts_datetime ON public.receipts USING btree (iv_datetime);
CREATE INDEX idx_receipts_datetime_ivtype ON public.receipts USING btree (iv_datetime, iv_type);
CREATE INDEX idx_receipts_iv_num ON public.receipts USING btree (iv_num);

-- Functions
CREATE OR REPLACE FUNCTION public.generate_invoice_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.id IS NULL THEN
        NEW.id := NEW.iv_num || '_' || NEW.sku;
    END IF;
    RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_bi_data(start_date date, end_date date)
 RETURNS TABLE(branch_name text, revenue numeric, returns numeric, trans_count integer, net_profit numeric, sellers jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        t.branch_name,
        -- סכימת הכנסות (חיובי בלבד)
        COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as revenue,
        -- סכימת החזרות (שלילי בלבד)
        COALESCE(SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END), 0) as returns,
        -- ספירת עסקאות
        COUNT(*)::INTEGER as trans_count,
        -- חישוב רווח נקי (סכום כולל / 1.18)
        COALESCE(SUM(t.amount) / 1.18, 0) as net_profit,
        -- יצירת JSON של מוכרים
        COALESCE(
            jsonb_agg(jsonb_build_object('name', t.seller_name, 'val', t.amount / 1.18)) 
            FILTER (WHERE t.seller_name IS NOT NULL), '[]'::jsonb
        ) as sellers
    FROM 
        invoices_archive t
    WHERE 
        t.iv_date >= start_date AND t.iv_date <= end_date
    GROUP BY 
        t.branch_name;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_product_filter_options()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'families',   COALESCE((SELECT json_agg(f ORDER BY f) FROM (SELECT DISTINCT family_description AS f FROM products WHERE family_description IS NOT NULL AND trim(family_description) <> '') sub), '[]'::json),
    'techniques', COALESCE((SELECT json_agg(t ORDER BY t) FROM (SELECT DISTINCT technique AS t FROM products WHERE technique IS NOT NULL AND trim(technique) <> '') sub), '[]'::json),
    'sizes',      COALESCE((SELECT json_agg(s ORDER BY s) FROM (SELECT DISTINCT international_size AS s FROM products WHERE international_size IS NOT NULL AND trim(international_size) <> '' AND international_size LIKE '%*%') sub), '[]'::json),
    'colors',     COALESCE((SELECT json_agg(c ORDER BY c) FROM (SELECT DISTINCT color AS c FROM products WHERE color IS NOT NULL AND trim(color) <> '') sub), '[]'::json),
    'shapes',     COALESCE((SELECT json_agg(sh ORDER BY sh) FROM (SELECT DISTINCT shape AS sh FROM products WHERE shape IS NOT NULL AND trim(shape) <> '') sub), '[]'::json),
    'styles',     COALESCE((SELECT json_agg(st ORDER BY st) FROM (SELECT DISTINCT style AS st FROM products WHERE style IS NOT NULL AND trim(style) <> '') sub), '[]'::json),
    'fringes',    COALESCE((SELECT json_agg(fr ORDER BY fr) FROM (SELECT DISTINCT fringes AS fr FROM products WHERE fringes IS NOT NULL AND trim(fringes) <> '') sub), '[]'::json),
    'materials',   COALESCE((SELECT json_agg(m ORDER BY m) FROM (SELECT DISTINCT material AS m FROM products WHERE material IS NOT NULL AND trim(material) <> '') sub), '[]'::json)
  );
$function$


CREATE OR REPLACE FUNCTION public.set_quote_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$


-- Triggers
-- Trigger: trg_generate_invoice_id on invoices_salerows
-- BEFORE INSERT: EXECUTE FUNCTION generate_invoice_id()

-- Row Level Security
ALTER TABLE public.branch_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designer_restricted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_exclusions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable insert/update for admins only" ON public.branch_goals AS PERMISSIVE FOR ALL TO {, p, u, b, l, i, c, }
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))));
CREATE POLICY "Enable read access for all users" ON public.branch_goals AS PERMISSIVE FOR SELECT TO {, p, u, b, l, i, c, }
  USING (true);
CREATE POLICY "Allow insert for authenticated services" ON public.branch_visitors AS PERMISSIVE FOR INSERT TO {, p, u, b, l, i, c, }
  WITH CHECK (true);
CREATE POLICY "Allow public read access" ON public.branch_visitors AS PERMISSIVE FOR SELECT TO {, p, u, b, l, i, c, }
  USING (true);
CREATE POLICY "Allow all for service role" ON public.customer_visits AS PERMISSIVE FOR ALL TO {, s, e, r, v, i, c, e, _, r, o, l, e, }
  USING (true);
CREATE POLICY "Allow read for authenticated" ON public.customer_visits AS PERMISSIVE FOR SELECT TO {, a, u, t, h, e, n, t, i, c, a, t, e, d, }
  USING (true);
CREATE POLICY "allow_admin_manage_whitelist" ON public.designer_restricted AS PERMISSIVE FOR ALL TO {, p, u, b, l, i, c, }
  USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::text)))));
CREATE POLICY "allow_read_whitelist" ON public.designer_restricted AS PERMISSIVE FOR SELECT TO {, p, u, b, l, i, c, }
  USING (true);
CREATE POLICY "Allow admin to manage logparts" ON public.products AS PERMISSIVE FOR ALL TO {, p, u, b, l, i, c, }
  USING ((auth.uid() IN ( SELECT user_roles.user_id
   FROM user_roles
  WHERE (user_roles.role = 'admin'::text))));
CREATE POLICY "Allow public read access" ON public.products AS PERMISSIVE FOR SELECT TO {, p, u, b, l, i, c, }
  USING (true);
CREATE POLICY "push_sub_delete" ON public.push_subscriptions AS PERMISSIVE FOR DELETE TO {, p, u, b, l, i, c, }
  USING ((auth.uid() = user_id));
CREATE POLICY "push_sub_insert" ON public.push_subscriptions AS PERMISSIVE FOR INSERT TO {, p, u, b, l, i, c, }
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "push_sub_select" ON public.push_subscriptions AS PERMISSIVE FOR SELECT TO {, p, u, b, l, i, c, }
  USING ((auth.uid() = user_id));
CREATE POLICY "push_sub_service_read" ON public.push_subscriptions AS PERMISSIVE FOR SELECT TO {, p, u, b, l, i, c, }
  USING (true);
CREATE POLICY "admin only" ON public.trend_exclusions AS PERMISSIVE FOR ALL TO {, p, u, b, l, i, c, }
  USING (true)
  WITH CHECK (true);