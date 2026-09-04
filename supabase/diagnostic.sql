-- =============================================================================
-- Kissan AI — Diagnostic Query
-- =============================================================================
-- Run this in Supabase Dashboard -> SQL Editor -> New query
-- Paste this, click Run, and share the result rows with me.
-- =============================================================================

-- 1. Did the tables actually get created?
SELECT '1. tables_exist' AS check_name,
       array_agg(tablename ORDER BY tablename)::text AS result
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('farms','diagnoses','expenses','chat_conversations',
                    'chat_messages','farm_events','risk_alerts','action_items');

-- 2. Is RLS enabled on expenses?
SELECT '2. expenses_rls' AS check_name,
       relrowsecurity::text AS result
FROM pg_class
WHERE relname = 'expenses' AND relnamespace = 'public'::regnamespace;

-- 3. What RLS policies exist on expenses?
SELECT '3. expenses_policies' AS check_name,
       polname AS policy_name,
       cmd AS command
FROM pg_policy
WHERE polrelid = 'public.expenses'::regclass;

-- 4. How many farms exist in the DB?
SELECT '4. farm_count' AS check_name,
       COUNT(*)::text AS result
FROM public.farms;

-- 5. How many expenses exist in the DB?
SELECT '5. expense_count' AS check_name,
       COUNT(*)::text AS result
FROM public.expenses;

-- 6. Does the user_owns_farm helper function exist?
SELECT '6. helper_fn' AS check_name,
       COALESCE(proname, 'MISSING') AS result
FROM pg_proc
WHERE proname = 'user_owns_farm' AND pronamespace = 'public'::regnamespace;

-- 7. Does the crop-images storage bucket exist?
SELECT '7. storage_bucket' AS check_name,
       COALESCE(id, 'MISSING') AS result
FROM storage.buckets
WHERE id = 'crop-images';
