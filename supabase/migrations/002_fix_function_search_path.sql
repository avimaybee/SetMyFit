-- ============================================
-- Migration: Fix Function Search Path Mutable
-- Issue: Functions have mutable search_path (security risk)
-- Run this in Supabase SQL Editor
-- ============================================

-- Fix: update_personas_updated_at
CREATE OR REPLACE FUNCTION public.update_personas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Fix: increment_wear_count
CREATE OR REPLACE FUNCTION public.increment_wear_count(item_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clothing_items 
  SET wear_count = COALESCE(wear_count, 0) + 1,
      last_worn = timezone('utc'::text, now())
  WHERE id = item_id;
END;
$$;

-- Fix: apply_retention_policy
CREATE OR REPLACE FUNCTION public.apply_retention_policy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete old outfit recommendations older than 90 days
  DELETE FROM public.outfit_recommendations 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete old outfits older than 1 year
  DELETE FROM public.outfits 
  WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$;

-- Fix: update_updated_at_timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Fix: update_clothing_item_wear_state
CREATE OR REPLACE FUNCTION public.update_clothing_item_wear_state(
  p_item_id bigint,
  p_last_worn timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clothing_items 
  SET 
    wear_count = COALESCE(wear_count, 0) + 1,
    last_worn = COALESCE(p_last_worn, timezone('utc'::text, now()))
  WHERE id = p_item_id;
END;
$$;

-- Verify the fixes
-- Run this to check search_path is now set:
-- SELECT proname, prosecdef, proconfig 
-- FROM pg_proc 
-- WHERE pronamespace = 'public'::regnamespace 
-- AND proname IN ('update_personas_updated_at', 'increment_wear_count', 'apply_retention_policy', 'update_updated_at_timestamp', 'update_clothing_item_wear_state');
