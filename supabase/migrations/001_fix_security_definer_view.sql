-- ============================================
-- Migration: Fix Security Definer View
-- Issue: wardrobe_analytics view has SECURITY DEFINER
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop and recreate the view with SECURITY INVOKER (default)
-- This ensures RLS policies of the querying user are enforced

DROP VIEW IF EXISTS public.wardrobe_analytics;

-- Recreate with SECURITY INVOKER (the default, safer option)
-- Note: You may need to adjust this based on the original view definition
-- If the view doesn't exist or has a different structure, this will create a basic one

CREATE OR REPLACE VIEW public.wardrobe_analytics 
WITH (security_invoker = true)
AS
SELECT 
  ci.user_id,
  ci.type,
  ci.category,
  ci.color,
  ci.material,
  COUNT(*) as item_count,
  COUNT(CASE WHEN ci.is_favorite THEN 1 END) as favorite_count,
  AVG(ci.wear_count) as avg_wear_count,
  MAX(ci.last_worn) as last_worn_any
FROM public.clothing_items ci
GROUP BY ci.user_id, ci.type, ci.category, ci.color, ci.material;

-- Add RLS policy for the view (optional, if needed)
-- ALTER VIEW public.wardrobe_analytics OWNER TO authenticated;

COMMENT ON VIEW public.wardrobe_analytics IS 'Analytics view with SECURITY INVOKER for proper RLS enforcement';
