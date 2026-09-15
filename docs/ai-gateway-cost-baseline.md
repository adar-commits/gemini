# AI Gateway cost baseline

Use **Vercel AI Gateway dashboard** as the billing source of truth. Supabase `hom_agent_token_usage` is for attribution only.

## Deploy stamp — cost optimization v1

| Field | Value |
|-------|-------|
| **Deployed at (IL)** | **2026-09-15 22:50 Asia/Jerusalem** |
| **Deployed at (UTC)** | 2026-09-15T19:50:00Z |
| **Git marker** | `cost-optimization-2026-09-15` |

### Changes live after stamp

1. `history_limit`: **16 → 10** (production Supabase + code defaults)
2. Conversation summary: every **5** customer turns (was 8)
3. Opus escalation tightened:
   - Service/defect keywords → Opus only if **≥8 words** or **image**
   - Multi-intent → Opus only if **≥28 words** OR **≥20 words + 2 connectors** (`וגם` / `ואז` / `בנוסף`)
   - Dissatisfaction, policy dispute, human handoff → still Opus
4. Goku manual-only (deployed earlier Sep 14 ~12:30 IL)

### Vercel baseline **before** this stamp (operator-provided)

| Window | Spend | Requests | Tokens |
|--------|-------|----------|--------|
| Last 12h @ 2026-09-15 22:40 IL | **$25.09** | **523** | **13M** |
| Last 7d @ 2026-09-15 ~16:30 IL | **$130** | **2.8K** | **57M** |

### Expected impact (estimate — verify on Vercel after 24h)

- **~15–20%** lower spend on comparable traffic vs pre-stamp 12h window
- Target next check: **≤ $21 / 12h** at similar request volume (~500)

### How to compare tomorrow

Paste a Vercel screenshot and say **"compare to cost baseline"**. Only count usage **after 2026-09-15 22:50 IL**.
