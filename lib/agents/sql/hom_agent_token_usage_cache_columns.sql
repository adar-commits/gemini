-- Prompt-cache attribution (Token Optimization Council A)
alter table public.hom_agent_token_usage
  add column if not exists cache_read_tokens int not null default 0,
  add column if not exists cache_write_tokens int not null default 0;
