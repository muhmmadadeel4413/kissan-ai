-- =============================================================================
-- Kissan AI — Expense INSERT Test
-- =============================================================================
-- Run BOTH parts in the SQL Editor. Share the results with me.
-- =============================================================================

-- =====================================================================
-- PART 1: Direct insert as database owner (BYPASSES RLS)
-- This tests whether the table schema itself is correct.
-- =====================================================================
DO $$
DECLARE
  v_farm_id uuid;
  v_inserted_id uuid;
BEGIN
  -- Grab any existing farm (we'll undo the insert afterward).
  SELECT id INTO v_farm_id FROM public.farms LIMIT 1;

  IF v_farm_id IS NULL THEN
    RAISE NOTICE 'TEST SKIPPED: No farms exist in the database. Complete Farm Setup first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Test 1: Using farm_id = %', v_farm_id;

  BEGIN
    INSERT INTO public.expenses (farm_id, category, amount, description, expense_date)
    VALUES (v_farm_id, 'seeds', 100.00, 'TEST INSERT — safe to delete', CURRENT_DATE)
    RETURNING id INTO v_inserted_id;
    RAISE NOTICE 'TEST 1 PASSED: inserted id = %', v_inserted_id;

    -- Clean up the test row.
    DELETE FROM public.expenses WHERE id = v_inserted_id;
    RAISE NOTICE 'Test row cleaned up.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST 1 FAILED: %', SQLERRM;
  END;
END;
$$;

-- =====================================================================
-- PART 2: Insert as an authenticated user (HONOURS RLS)
-- This tests whether the RLS policies actually allow the insert.
-- We impersonate `authenticated` but we cannot set auth.uid() from SQL
-- — that's set by Supabase Auth. So this will return 0 rows unless you
-- happen to own a farm row whose user_id matches YOUR auth.uid().
-- =====================================================================
DO $$
DECLARE
  v_farm_id uuid;
  v_user_id uuid;
  v_inserted_id uuid;
BEGIN
  -- Show the currently signed-in user's ID (if any).
  v_user_id := auth.uid();
  RAISE NOTICE 'Test 2: auth.uid() = %', COALESCE(v_user_id::text, 'NULL (not signed in)');

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'TEST 2 SKIPPED: Not signed in via Supabase Auth.';
    RETURN;
  END IF;

  SELECT id INTO v_farm_id FROM public.farms WHERE user_id = v_user_id LIMIT 1;
  IF v_farm_id IS NULL THEN
    RAISE NOTICE 'TEST 2 SKIPPED: No farm row with user_id = your auth.uid().';
    RETURN;
  END IF;

  RAISE NOTICE 'Test 2: trying INSERT as authenticated user into farm %', v_farm_id;

  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.expenses (farm_id, category, amount, description, expense_date)
    VALUES (v_farm_id, 'seeds', 50.00, 'RLS TEST — safe to delete', CURRENT_DATE)
    RETURNING id INTO v_inserted_id;
    RAISE NOTICE 'TEST 2 PASSED: inserted id = %', v_inserted_id;

    DELETE FROM public.expenses WHERE id = v_inserted_id;
    RAISE NOTICE 'Test row cleaned up.';
    SET LOCAL ROLE postgres;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST 2 FAILED: %', SQLERRM;
    SET LOCAL ROLE postgres;
  END;
END;
$$;

-- =====================================================================
-- PART 3: Show what Supabase thinks the current auth context is.
-- =====================================================================
SELECT
  auth.uid() AS current_auth_uid,
  auth.role() AS current_auth_role,
  current_user AS db_role;

-- =====================================================================
-- PART 4: List farm rows with their user_id (so we can compare).
-- =====================================================================
SELECT id, user_id, farmer_name, current_crop, location
FROM public.farms
ORDER BY created_at DESC
LIMIT 5;
