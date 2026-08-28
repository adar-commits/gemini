-- Token optimization monitoring (Landbot Supabase)
-- Run in SQL editor or via psql against walklyxhkhrdzbkfhtez

-- 1) Avg tokens per purpose (last 24h)
SELECT
  purpose,
  COUNT(*) AS calls,
  ROUND(AVG(input_tokens + output_tokens)) AS avg_total_tokens,
  SUM(input_tokens + output_tokens) AS sum_total_tokens
FROM hom_agent_token_usage
WHERE created_at > now() - interval '24 hours'
GROUP BY purpose
ORDER BY sum_total_tokens DESC;

-- 2) Avg tokens per conversation per day
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(DISTINCT conversation_id) AS conversations,
  ROUND(AVG(input_tokens + output_tokens)) AS avg_tokens_per_call,
  SUM(input_tokens + output_tokens) AS total_tokens
FROM hom_agent_token_usage
WHERE created_at > now() - interval '7 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 3) Master skip rate from shadow logs
SELECT
  routing_path,
  COUNT(*) AS turns,
  ROUND(AVG(llm_calls), 2) AS avg_llm_calls,
  ROUND(AVG(input_tokens + output_tokens)) AS avg_tokens
FROM hom_agent_shadow_logs
WHERE created_at > now() - interval '24 hours'
  AND routing_path IS NOT NULL
GROUP BY routing_path
ORDER BY turns DESC;

-- 4) Route disagreement rate (master LLM vs guessMasterRoute)
SELECT
  agree,
  COUNT(*) AS rows,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM hom_agent_route_disagreements
WHERE created_at > now() - interval '7 days'
GROUP BY agree;

-- 5) Top disagreements to review for T1 allowlist expansion
SELECT
  guessed_route,
  master_action,
  COUNT(*) AS n
FROM hom_agent_route_disagreements
WHERE created_at > now() - interval '7 days'
  AND agree = false
GROUP BY guessed_route, master_action
ORDER BY n DESC
LIMIT 20;

-- 6) Never-stuck rate (adjust reply pattern if copy changes)
SELECT COUNT(*) AS never_stuck_count
FROM hom_agent_shadow_logs
WHERE created_at > now() - interval '24 hours'
  AND draft_reply ILIKE '%נראה שההודעה לא עברה%';
