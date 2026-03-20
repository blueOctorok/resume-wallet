# AvA Chat 500 Errors on Vercel

If `/api/ai/chat` or `/api/ai/credits` return **500** in production (Vercel), check the following.

## 1. Run the migration on production Supabase

The AvA usage feature uses the **`ava_chat_usage`** table. If this table doesn’t exist, both endpoints will 500.

**Fix:** Run the migration on your **production** Supabase project (the one used by the Vercel deploy):

- Either link the repo to Supabase and run migrations from the Supabase dashboard, or
- Run locally against the production DB:  
  `npx supabase db push` (or apply `supabase/migrations/052_ava_chat_usage.sql` manually in the SQL editor).

In Vercel logs you’ll typically see something like:

- `ava_chat_usage read failed [42P01]: relation "ava_chat_usage" does not exist`

That means the migration hasn’t been applied to the DB that Vercel is using.

## 2. Environment variables on Vercel

Ensure these are set in **Vercel → Project → Settings → Environment Variables** (for the environment you’re using: Production/Preview):

| Variable | Required for | Notes |
|----------|----------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Chat + Credits | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Chat + Credits | Service role key (server-only) |
| `AVA_BRAIN` | Chat only | Anthropic API key for Claude |

If Supabase URL or service role key is missing, you’ll get **503** “Service temporarily unavailable” and a log like:

- `[AvA Chat] Supabase init failed: Supabase admin client is not configured...`

If `AVA_BRAIN` is missing, the chat endpoint returns **503** “AI service is not configured.”

## 3. Check Vercel logs

After deploying:

1. Open **Vercel → Project → Logs** (or **Deployments → [deployment] → Functions**).
2. Trigger AvA (send a message or load the hub so credits are fetched).
3. Look for `[AvA Chat]` or `[AvA Credits]` in the logs. The message after the colon is the underlying error (e.g. missing table, missing env, or Anthropic error).

That will tell you whether the problem is the migration, env vars, or the AI provider.
