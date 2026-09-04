-- =============================================================================
-- Kissan AI — Supabase Database Setup Script
-- =============================================================================
--
-- Run this ONCE in your Supabase project's SQL editor:
--   Supabase Dashboard  ->  SQL Editor  ->  New query  ->  Paste this file  ->  Run
--
-- Creates:
--   - 8 tables (farms, diagnoses, expenses, chat_conversations, chat_messages,
--               farm_events, risk_alerts, action_items)
--   - 1 storage bucket (crop-images) for Crop Doctor photos
--   - Row Level Security policies on every table (scoped to auth.uid())
--   - Indexes for common query patterns
--   - Triggers to auto-set user_id on farms and updated_at on mutable tables
--   - Helper function `user_owns_farm(uuid)` reused by every RLS policy
--
-- This script is idempotent — safe to run again. It uses `IF NOT EXISTS`
-- on every object creation, so reruns do nothing destructive.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: does the current auth.uid() own a given farm?
-- Reused by every child-table RLS policy so we don't repeat the sub-select.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_owns_farm(p_farm_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farms
    WHERE id = p_farm_id AND user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Helper: auto-fill user_id from auth.uid() when the client doesn't send it.
-- Applied as a BEFORE INSERT trigger on every user-owned table.
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
-- 1. FARMS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.farms (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farmer_name           text NOT NULL,
  phone                 text,
  email                 text,
  location              text NOT NULL,
  land_area             text NOT NULL,
  soil_type             text NOT NULL,
  irrigation_method     text NOT NULL,
  current_crop          text NOT NULL,
  current_crop_variety  text,
  planting_date         date,
  farm_name             text,
  water_source          text,
  farm_age_years        integer,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Auto-fill user_id from auth.uid() if the client doesn't provide it.
CREATE OR REPLACE FUNCTION public.set_farm_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_farm_user_id ON public.farms;
CREATE TRIGGER trg_set_farm_user_id
BEFORE INSERT ON public.farms
FOR EACH ROW EXECUTE FUNCTION public.set_farm_user_id();

-- ---------------------------------------------------------------------------
-- Helper: auto-set updated_at on row updates.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farms_select_own ON public.farms;
CREATE POLICY farms_select_own ON public.farms
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS farms_insert_own ON public.farms;
CREATE POLICY farms_insert_own ON public.farms
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS farms_update_own ON public.farms;
CREATE POLICY farms_update_own ON public.farms
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS farms_delete_own ON public.farms;
CREATE POLICY farms_delete_own ON public.farms
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms(user_id);

-- Previously enforced one farm per user; now removed for multi-farm support.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farms_user_id_unique'
  ) THEN
    ALTER TABLE public.farms DROP CONSTRAINT farms_user_id_unique;
  END IF;
END $$;

-- =========================================================================
-- 2. DIAGNOSES
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.diagnoses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               uuid REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  crop                  text NOT NULL,
  diagnosis             text NOT NULL,
  severity              text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'none')),
  confidence            numeric NOT NULL,
  description           text,
  causes                text[],
  recommended_actions   text[],
  notes                 text,
  image_url             text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diagnoses_select ON public.diagnoses;
CREATE POLICY diagnoses_select ON public.diagnoses
  FOR SELECT USING (
    farm_id IS NULL OR public.user_owns_farm(farm_id)
  );

DROP POLICY IF EXISTS diagnoses_insert ON public.diagnoses;
CREATE POLICY diagnoses_insert ON public.diagnoses
  FOR INSERT WITH CHECK (
    farm_id IS NULL OR public.user_owns_farm(farm_id)
  );

DROP POLICY IF EXISTS diagnoses_update ON public.diagnoses;
CREATE POLICY diagnoses_update ON public.diagnoses
  FOR UPDATE USING (
    farm_id IS NULL OR public.user_owns_farm(farm_id)
  );

DROP POLICY IF EXISTS diagnoses_delete ON public.diagnoses;
CREATE POLICY diagnoses_delete ON public.diagnoses
  FOR DELETE USING (
    farm_id IS NULL OR public.user_owns_farm(farm_id)
  );

CREATE INDEX IF NOT EXISTS idx_diagnoses_farm_id ON public.diagnoses(farm_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_created_at ON public.diagnoses(created_at DESC);

DROP TRIGGER IF EXISTS trg_diagnoses_fill_user_id ON public.diagnoses;
CREATE TRIGGER trg_diagnoses_fill_user_id
BEFORE INSERT ON public.diagnoses
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth();

-- =========================================================================
-- 3. EXPENSES
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category              text NOT NULL CHECK (category IN (
                          'seeds','fertilizer','pesticide','labor','irrigation',
                          'equipment','fuel','transport','other'
                        )),
  amount                numeric(12,2) NOT NULL CHECK (amount > 0),
  description           text,
  expense_date          date NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expenses_select ON public.expenses;
CREATE POLICY expenses_select ON public.expenses
  FOR SELECT USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS expenses_insert ON public.expenses;
CREATE POLICY expenses_insert ON public.expenses
  FOR INSERT WITH CHECK (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS expenses_update ON public.expenses;
CREATE POLICY expenses_update ON public.expenses
  FOR UPDATE USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS expenses_delete ON public.expenses;
CREATE POLICY expenses_delete ON public.expenses
  FOR DELETE USING (public.user_owns_farm(farm_id));

CREATE INDEX IF NOT EXISTS idx_expenses_farm_id ON public.expenses(farm_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(farm_id, expense_date DESC);

DROP TRIGGER IF EXISTS trg_expenses_fill_user_id ON public.expenses;
CREATE TRIGGER trg_expenses_fill_user_id
BEFORE INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth();

-- =========================================================================
-- 4. CHAT_CONVERSATIONS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_conv_select ON public.chat_conversations;
CREATE POLICY chat_conv_select ON public.chat_conversations
  FOR SELECT USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS chat_conv_insert ON public.chat_conversations;
CREATE POLICY chat_conv_insert ON public.chat_conversations
  FOR INSERT WITH CHECK (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS chat_conv_update ON public.chat_conversations;
CREATE POLICY chat_conv_update ON public.chat_conversations
  FOR UPDATE USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS chat_conv_delete ON public.chat_conversations;
CREATE POLICY chat_conv_delete ON public.chat_conversations
  FOR DELETE USING (public.user_owns_farm(farm_id));

DROP TRIGGER IF EXISTS trg_chat_conv_updated_at ON public.chat_conversations;
CREATE TRIGGER trg_chat_conv_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_chat_conv_farm_id ON public.chat_conversations(farm_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_updated_at ON public.chat_conversations(updated_at DESC);

DROP TRIGGER IF EXISTS trg_chat_conv_fill_user_id ON public.chat_conversations;
CREATE TRIGGER trg_chat_conv_fill_user_id
BEFORE INSERT ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth();

-- =========================================================================
-- 5. CHAT_MESSAGES
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  farm_id               uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role                  text NOT NULL CHECK (role IN ('user', 'assistant')),
  content               text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_msg_select ON public.chat_messages;
CREATE POLICY chat_msg_select ON public.chat_messages
  FOR SELECT USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS chat_msg_insert ON public.chat_messages;
CREATE POLICY chat_msg_insert ON public.chat_messages
  FOR INSERT WITH CHECK (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS chat_msg_update ON public.chat_messages;
CREATE POLICY chat_msg_update ON public.chat_messages
  FOR UPDATE USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS chat_msg_delete ON public.chat_messages;
CREATE POLICY chat_msg_delete ON public.chat_messages
  FOR DELETE USING (public.user_owns_farm(farm_id));

CREATE INDEX IF NOT EXISTS idx_chat_msg_conversation_id
  ON public.chat_messages(conversation_id, created_at);

-- Composite index for queries that fetch all messages for a farm (across
-- conversations), ordered chronologically.
CREATE INDEX IF NOT EXISTS idx_chat_msg_farm_id
  ON public.chat_messages(farm_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_chat_msg_fill_user_id ON public.chat_messages;
CREATE TRIGGER trg_chat_msg_fill_user_id
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth();

-- =========================================================================
-- 6. FARM_EVENTS (Crop Calendar)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.farm_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type            text NOT NULL CHECK (event_type IN (
                          'irrigation','fertilizer','pesticide','pest_monitoring',
                          'harvest','inspection','other'
                        )),
  title                 text NOT NULL,
  description           text,
  scheduled_date        date NOT NULL,
  status                text NOT NULL CHECK (status IN ('scheduled','completed','skipped')),
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.farm_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farm_events_select ON public.farm_events;
CREATE POLICY farm_events_select ON public.farm_events
  FOR SELECT USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS farm_events_insert ON public.farm_events;
CREATE POLICY farm_events_insert ON public.farm_events
  FOR INSERT WITH CHECK (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS farm_events_update ON public.farm_events;
CREATE POLICY farm_events_update ON public.farm_events
  FOR UPDATE USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS farm_events_delete ON public.farm_events;
CREATE POLICY farm_events_delete ON public.farm_events
  FOR DELETE USING (public.user_owns_farm(farm_id));

CREATE INDEX IF NOT EXISTS idx_farm_events_farm_id ON public.farm_events(farm_id);
CREATE INDEX IF NOT EXISTS idx_farm_events_scheduled_date
  ON public.farm_events(farm_id, scheduled_date);

DROP TRIGGER IF EXISTS trg_farm_events_fill_user_id ON public.farm_events;
CREATE TRIGGER trg_farm_events_fill_user_id
BEFORE INSERT ON public.farm_events
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth();

-- =========================================================================
-- 7. RISK_ALERTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.risk_alerts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_type             text NOT NULL CHECK (risk_type IN (
                          'disease','pest','weather','irrigation','crop_stress'
                        )),
  level                 text NOT NULL CHECK (level IN ('low','medium','high')),
  title                 text NOT NULL,
  explanation           text NOT NULL,
  evidence              text[],
  recommended_actions   text[],
  status                text NOT NULL CHECK (status IN ('active','expired','resolved')),
  source                text NOT NULL CHECK (source IN ('deterministic','ai','hybrid')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz
);

ALTER TABLE public.risk_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risk_alerts_select ON public.risk_alerts;
CREATE POLICY risk_alerts_select ON public.risk_alerts
  FOR SELECT USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS risk_alerts_insert ON public.risk_alerts;
CREATE POLICY risk_alerts_insert ON public.risk_alerts
  FOR INSERT WITH CHECK (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS risk_alerts_update ON public.risk_alerts;
CREATE POLICY risk_alerts_update ON public.risk_alerts
  FOR UPDATE USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS risk_alerts_delete ON public.risk_alerts;
CREATE POLICY risk_alerts_delete ON public.risk_alerts
  FOR DELETE USING (public.user_owns_farm(farm_id));

DROP TRIGGER IF EXISTS trg_risk_alerts_updated_at ON public.risk_alerts;
CREATE TRIGGER trg_risk_alerts_updated_at
BEFORE UPDATE ON public.risk_alerts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_risk_alerts_farm_id ON public.risk_alerts(farm_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_status_active
  ON public.risk_alerts(farm_id, status) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_risk_alerts_fill_user_id ON public.risk_alerts;
CREATE TRIGGER trg_risk_alerts_fill_user_id
BEFORE INSERT ON public.risk_alerts
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth();

-- =========================================================================
-- 8. ACTION_ITEMS (Today's Actions)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.action_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id               uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action_date           date NOT NULL,
  title                 text NOT NULL,
  description           text NOT NULL,
  priority              text NOT NULL CHECK (priority IN ('high','medium','low')),
  category              text NOT NULL CHECK (category IN (
                          'crop_health','weather','irrigation','pest','disease',
                          'field_inspection','growth_stage','farm_management',
                          'harvest','monitoring'
                        )),
  reason                text NOT NULL,
  timing                text,
  source                text[],
  completed             boolean NOT NULL DEFAULT false,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_items_select ON public.action_items;
CREATE POLICY action_items_select ON public.action_items
  FOR SELECT USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS action_items_insert ON public.action_items;
CREATE POLICY action_items_insert ON public.action_items
  FOR INSERT WITH CHECK (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS action_items_update ON public.action_items;
CREATE POLICY action_items_update ON public.action_items
  FOR UPDATE USING (public.user_owns_farm(farm_id));

DROP POLICY IF EXISTS action_items_delete ON public.action_items;
CREATE POLICY action_items_delete ON public.action_items
  FOR DELETE USING (public.user_owns_farm(farm_id));

DROP TRIGGER IF EXISTS trg_action_items_updated_at ON public.action_items;
CREATE TRIGGER trg_action_items_updated_at
BEFORE UPDATE ON public.action_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_action_items_farm_id ON public.action_items(farm_id);
CREATE INDEX IF NOT EXISTS idx_action_items_action_date
  ON public.action_items(farm_id, action_date);

DROP TRIGGER IF EXISTS trg_action_items_fill_user_id ON public.action_items;
CREATE TRIGGER trg_action_items_fill_user_id
BEFORE INSERT ON public.action_items
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_auth();

-- =========================================================================
-- 9. STORAGE: crop-images bucket (used by Crop Doctor)
-- =========================================================================
-- Insert the bucket if it doesn't already exist. Storage buckets live in
-- the `storage.buckets` table owned by Supabase.
INSERT INTO storage.buckets (id, name, public)
SELECT 'crop-images', 'crop-images', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'crop-images');

-- Allow any authenticated user to upload into crop-images.
DROP POLICY IF EXISTS crop_images_auth_upload ON storage.objects;
CREATE POLICY crop_images_auth_upload ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'crop-images' AND auth.role() = 'authenticated'
  );

-- Allow anyone (public bucket) to read uploaded images.
DROP POLICY IF EXISTS crop_images_public_read ON storage.objects;
CREATE POLICY crop_images_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'crop-images');

-- Allow owners to delete their own uploads (scoped by path prefix = user_id).
DROP POLICY IF EXISTS crop_images_owner_delete ON storage.objects;
CREATE POLICY crop_images_owner_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'crop-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =========================================================================
-- Done! Refresh the Supabase dashboard to see the new tables.
-- =========================================================================
