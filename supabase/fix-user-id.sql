-- =============================================================================
-- FIX: auto-fill user_id on expenses + farm_events INSERTs
-- =============================================================================
-- The Kissan AI client does NOT send user_id in INSERT payloads.
-- The original tables had user_id NOT NULL, which rejected every save.
--
-- This script:
--   1. Makes user_id NULLABLE on expenses and farm_events (so missing values
--      don't hard-fail).
--   2. Adds BEFORE INSERT triggers that auto-fill user_id from auth.uid()
--      when the client doesn't provide it.
--
-- Safe to run multiple times (idempotent).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper trigger function: fills user_id from auth.uid() if NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fill_user_id_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required (and auth.uid() is null — are you signed in?)';
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================================================
-- expenses
-- =========================================================================
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Drop the NOT NULL constraint if present (idempotent via a check).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expenses'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.expenses ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_fill_user_id ON public.expenses;
CREATE TRIGGER trg_expenses_fill_user_id
BEFORE INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth();

-- =========================================================================
-- farm_events
-- =========================================================================
ALTER TABLE public.farm_events
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'farm_events'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.farm_events ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_farm_events_fill_user_id ON public.farm_events;
CREATE TRIGGER trg_farm_events_fill_user_id
BEFORE INSERT ON public.farm_events
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth();

-- =========================================================================
-- Backfill existing rows that somehow have NULL user_id (safety net).
-- =========================================================================
UPDATE public.expenses
SET user_id = (SELECT user_id FROM public.farms WHERE farms.id = expenses.farm_id)
WHERE user_id IS NULL AND farm_id IS NOT NULL;

UPDATE public.farm_events
SET user_id = (SELECT user_id FROM public.farms WHERE farms.id = farm_events.farm_id)
WHERE user_id IS NULL AND farm_id IS NOT NULL;

-- =========================================================================
-- Also check other tables that the client touches. If any of them have a
-- user_id NOT NULL column the client doesn't populate, the same bug will
-- bite on those pages. Drop NOT NULL + add the same trigger everywhere.
-- =========================================================================
DO $$
DECLARE
  tname text;
BEGIN
  FOREACH tname IN ARRAY ARRAY[
    'diagnoses','chat_conversations','chat_messages','risk_alerts','action_items'
  ] LOOP
    -- If the table has a user_id column, make it nullable and add the trigger.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tname AND column_name = 'user_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL', tname);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_fill_user_id ON public.%I', tname, tname);
      EXECUTE format(
        'CREATE TRIGGER trg_%s_fill_user_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth()',
        tname, tname
      );
    END IF;
  END LOOP;
END;
$$;

SELECT 'Fix applied. Try adding an expense again.' AS status;
