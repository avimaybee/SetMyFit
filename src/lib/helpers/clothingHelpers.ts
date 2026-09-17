import { IClothingItem } from '@/lib/types';
import { config } from '@/lib/config';

const MATERIAL_INSULATION_PRESETS: Record<string, number> = {
  wool: 8,
  fleece: 7,
  leather: 6,
  denim: 5,
  cotton: 3,
  linen: 2,
  silk: 2,
  synthetic: 3,
  polyester: 3,
  nylon: 2,
  'gore-tex': 6,
  down: 8,
  default: 3,
};

const TYPE_INSULATION_BASELINE: Record<IClothingItem['type'], number> = {
  Outerwear: 7,
  Top: 3,
  Bottom: 4,
  Footwear: 3,
  Accessory: 1,
  Headwear: 2,
};

const clampInsulation = (value: number) => Math.min(10, Math.max(0, value));

export function resolveInsulationValue(item: Partial<IClothingItem>): number {
  const raw = item.insulation_value;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clampInsulation(raw);
  }

  const materialKey = item.material?.toLowerCase();
  if (materialKey && MATERIAL_INSULATION_PRESETS[materialKey] !== undefined) {
    return MATERIAL_INSULATION_PRESETS[materialKey];
  }

  if (item.type && TYPE_INSULATION_BASELINE[item.type]) {
    return TYPE_INSULATION_BASELINE[item.type];
  }

  return MATERIAL_INSULATION_PRESETS.default;
}

/**
 * Filter items by last_worn to ensure variety
 */
export function filterByLastWorn<T extends IClothingItem>(
  items: T[],
  minDaysSinceWorn: number = config.app.recommendations.minDaysSinceWorn
): T[] {
  const now = new Date();
  const minMilliseconds = minDaysSinceWorn * 24 * 60 * 60 * 1000;

  return items.filter(item => {
    // Always include favorite items
    if (item.favorite) {
      return true;
    }
    
    if (!item.last_worn) {
      // Never worn items are always eligible
      return true;
    }

    const lastWorn = new Date(item.last_worn);
    const timeSinceWorn = now.getTime() - lastWorn.getTime();
    
    return timeSinceWorn >= minMilliseconds;
  }) as T[];
}
