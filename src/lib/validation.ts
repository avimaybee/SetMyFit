/**
 * Simple validation helpers using Zod
 */
import { z } from 'zod';
import { NextRequest } from 'next/server';

// Weather request schema
export const weatherRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

// Recommendation request schema
export const recommendationRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  occasion: z.string().optional(),
  lockedItems: z.array(z.string()).optional(),
});

// Helper to validate query params
export function validateQuery(request: NextRequest, schema: z.ZodSchema) {
  const { searchParams } = new URL(request.url);
  const params: Record<string, unknown> = {};
  
  searchParams.forEach((value, key) => {
    // Try to parse numbers
    const numValue = Number(value);
    params[key] = isNaN(numValue) ? value : numValue;
  });
  
  return schema.parse(params);
}

// Helper to validate request body
export async function validateBody(request: NextRequest, schema: z.ZodSchema) {
  const body = await request.json();
  return schema.parse(body);
}

// Valid clothing materials enum values
const VALID_MATERIALS = [
  'Cotton',
  'Wool',
  'Synthetic',
  'Gore-Tex',
  'Fleece',
  'Leather',
  'Denim',
  'Silk',
  'Linen',
  'Polyester',
  'Nylon',
] as const;

/**
 * Normalizes material values to match database enum
 * Maps common variations and blends to closest valid material
 */
export function normalizeMaterial(material: string | null | undefined): string {
  if (!material) return 'Cotton'; // Default fallback
  
  const normalized = material.trim();
  
  // Direct match (case-insensitive)
  const directMatch = VALID_MATERIALS.find(
    valid => valid.toLowerCase() === normalized.toLowerCase()
  );
  if (directMatch) return directMatch;
  
  // Handle common blends and variations
  const lowerMaterial = normalized.toLowerCase();
  
  // Cotton blends
  if (lowerMaterial.includes('cotton')) return 'Cotton';
  
  // Wool blends
  if (lowerMaterial.includes('wool') || lowerMaterial.includes('cashmere') || lowerMaterial.includes('merino')) return 'Wool';
  
  // Synthetic materials
  if (lowerMaterial.includes('polyester') || lowerMaterial.includes('poly')) return 'Polyester';
  if (lowerMaterial.includes('nylon')) return 'Nylon';
  if (lowerMaterial.includes('spandex') || lowerMaterial.includes('elastane') || lowerMaterial.includes('lycra')) return 'Synthetic';
  if (lowerMaterial.includes('acrylic') || lowerMaterial.includes('rayon') || lowerMaterial.includes('viscose')) return 'Synthetic';
  
  // Special materials
  if (lowerMaterial.includes('fleece')) return 'Fleece';
  if (lowerMaterial.includes('gore') || lowerMaterial.includes('waterproof') || lowerMaterial.includes('technical')) return 'Gore-Tex';
  if (lowerMaterial.includes('leather') || lowerMaterial.includes('suede')) return 'Leather';
  if (lowerMaterial.includes('denim') || lowerMaterial.includes('jean')) return 'Denim';
  if (lowerMaterial.includes('silk')) return 'Silk';
  if (lowerMaterial.includes('linen')) return 'Linen';
  
  // Default fallback for unknown materials
  return 'Cotton';
}
