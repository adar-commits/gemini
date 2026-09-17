-- Vector similarity search for KB chunks (plan L)
create or replace function public.match_hom_agent_kb_chunks(
  query_embedding vector(1536),
  match_count int default 3
)
returns table (
  section_id text,
  title text,
  content text,
  source text,
  similarity float
)
language sql
stable
as $$
  select
    c.section_id,
    c.title,
    c.content,
    c.source,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.hom_agent_kb_chunks c
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

revoke all on function public.match_hom_agent_kb_chunks(vector, int) from public;
grant execute on function public.match_hom_agent_kb_chunks(vector, int) to service_role;
