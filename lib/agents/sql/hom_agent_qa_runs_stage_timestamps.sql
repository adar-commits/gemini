-- Per-stage timestamps for QA dashboard duration stats.
alter table public.hom_agent_qa_runs
  add column if not exists stage_timestamps jsonb not null default '{}'::jsonb;

create index if not exists hom_agent_qa_runs_session_created_idx
  on public.hom_agent_qa_runs (session_id, created_at desc);
