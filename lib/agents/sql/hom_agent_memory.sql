-- Applied to Landbot project walklyxhkhrdzbkfhtez
create table if not exists public.hom_agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  agent text not null,
  action text,
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_messages_conversation_created_idx
  on public.hom_agent_messages (conversation_id, created_at desc);

create table if not exists public.hom_agent_sessions (
  conversation_id text primary key,
  reset_at timestamptz,
  last_agent text,
  updated_at timestamptz not null default now()
);

alter table public.hom_agent_messages enable row level security;
alter table public.hom_agent_sessions enable row level security;

revoke all on table public.hom_agent_messages from anon, authenticated, public;
revoke all on table public.hom_agent_sessions from anon, authenticated, public;

create table if not exists public.hom_agent_inbound (
  message_key text primary key,
  conversation_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_inbound_created_idx
  on public.hom_agent_inbound (created_at desc);

alter table public.hom_agent_inbound enable row level security;

revoke all on table public.hom_agent_inbound from anon, authenticated, public;

create table if not exists public.hom_agent_message_buffer (
  conversation_id text primary key,
  parts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hom_agent_message_buffer enable row level security;

revoke all on table public.hom_agent_message_buffer from anon, authenticated, public;

create table if not exists public.hom_agent_shadow_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  customer_id bigint,
  phone text,
  user_text text not null default '',
  agent text not null,
  action text,
  draft_reply text not null default '',
  replied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_shadow_logs_created_idx
  on public.hom_agent_shadow_logs (created_at desc);

create index if not exists hom_agent_shadow_logs_phone_created_idx
  on public.hom_agent_shadow_logs (phone, created_at desc);

alter table public.hom_agent_shadow_logs enable row level security;

revoke all on table public.hom_agent_shadow_logs from anon, authenticated, public;
