-- Hybrid KB retrieval (Token Optimization Council H)
create extension if not exists vector;

create table if not exists public.hom_agent_kb_chunks (
  id uuid primary key default gen_random_uuid(),
  section_id text not null unique,
  title text not null default '',
  content text not null,
  source text not null default 'faq',
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_kb_chunks_source_idx
  on public.hom_agent_kb_chunks (source);

-- Run ivfflat index after seeding rows: see scripts/seed-kb-chunks.ts

alter table public.hom_agent_kb_chunks enable row level security;
revoke all on table public.hom_agent_kb_chunks from anon, authenticated, public;

alter table public.hom_agent_sessions
  add column if not exists opus_escalated_reason text;
