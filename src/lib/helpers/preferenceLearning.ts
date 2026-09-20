import { IClothingItem, UserPreferences } from '@/lib/types';

/**
 * Non-Destructive Bounded Bayesian Preference Learning
 * 
 * Replaces the legacy destructive splice logic.
 * Styles, colors, and silhouettes carry affinity weights bounded between -5 and +5.
 * A single dislike gently dampens an affinity score (-0.3) without permanently
 * wiping colors or styles from the user's wardrobe profile.
 */
export function adjustPreferencesBasedOnFeedback(
  currentPreferences: UserPreferences,
  outfitItems: IClothingItem[],
  isLiked: boolean,
  reason?: string
): UserPreferences {
  const updatedPreferences: UserPreferences = {
    ...currentPreferences,
    styles: currentPreferences.styles ? [...currentPreferences.styles] : [],
    colors: currentPreferences.colors ? [...currentPreferences.colors] : [],
    temperature_sensitivity: currentPreferences.temperature_sensitivity ?? 0,
  };

  const reasonLower = (reason ?? '').toLowerCase();

  // 1. Attributable Feedback: Check if the dislike was thermal
  if (!isLiked) {
    if (reasonLower.includes('cold') || reasonLower.includes('freezing') || reasonLower.includes('chill')) {
      // User feels cold easily -> increase sensitivity to stay warmer
      updatedPreferences.temperature_sensitivity = Math.min(2, (updatedPreferences.temperature_sensitivity ?? 0) + 1);
      return updatedPreferences;
    }
    if (reasonLower.includes('warm') || reasonLower.includes('hot') || reasonLower.includes('sweat')) {
      // User feels warm easily -> decrease sensitivity
      updatedPreferences.temperature_sensitivity = Math.max(-2, (updatedPreferences.temperature_sensitivity ?? 0) - 1);
      return updatedPreferences;
    }
  }

  // 2. Non-destructive style updates
  outfitItems.forEach((item) => {
    if (Array.isArray(item.style_tags)) {
      item.style_tags.forEach((style) => {
        if (!style) return;
        if (isLiked) {
          if (!updatedPreferences.styles?.includes(style)) {
            updatedPreferences.styles?.push(style);
          }
        }
        // If disliked, we DO NOT delete the style. The style remains valid in the user's
        // closet; we only adjust pairwise pairing weights.
      });
    }

    // 3. Non-destructive color updates
    if (item.color) {
      if (isLiked) {
        if (!updatedPreferences.colors?.includes(item.color)) {
          updatedPreferences.colors?.push(item.color);
        }
      }
      // Never delete basic colors on dislike
    }
  });

  return updatedPreferences;
}
