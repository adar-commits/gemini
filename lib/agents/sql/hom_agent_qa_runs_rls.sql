-- Only gemini's server (service role, bypasses RLS) reads/writes QA runs; block the public anon key.
alter table public.hom_agent_qa_runs enable row level security;
