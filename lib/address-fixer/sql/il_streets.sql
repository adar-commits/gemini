-- AI Address Fixer — street reference data + request log.
-- Run once on the Landbot Supabase project (same project as the agent tables).

create table if not exists public.il_streets (
  city_code integer not null,
  city_name text not null,
  street_code integer not null,
  street_name text not null,
  city_key text not null default '',
  street_key text not null default '',
  updated_at timestamptz not null default now(),
  primary key (city_code, street_code)
);

create index if not exists il_streets_city_key_idx on public.il_streets (city_key);
create index if not exists il_streets_street_key_idx on public.il_streets (street_key);

alter table public.il_streets enable row level security;

drop policy if exists il_streets_service_role on public.il_streets;
create policy il_streets_service_role on public.il_streets
  for all to service_role using (true) with check (true);

-- Request log — used to tune matching thresholds. Stores no contact details.
create table if not exists public.address_fixer_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  input_city text not null default '',
  input_street text not null default '',
  input_units text not null default '',
  output_city text not null default '',
  output_street text not null default '',
  output_street_no text not null default '',
  output_floor text not null default '',
  output_apartment text not null default '',
  output_entrance text not null default '',
  city_matched boolean not null default false,
  street_matched boolean not null default false,
  confidence numeric not null default 0,
  match_tier text not null default '',
  notes text[] not null default '{}'
);

create index if not exists address_fixer_logs_created_at_idx
  on public.address_fixer_logs (created_at desc);
create index if not exists address_fixer_logs_unmatched_idx
  on public.address_fixer_logs (street_matched, created_at desc);

alter table public.address_fixer_logs enable row level security;

drop policy if exists address_fixer_logs_service_role on public.address_fixer_logs;
create policy address_fixer_logs_service_role on public.address_fixer_logs
  for all to service_role using (true) with check (true);
