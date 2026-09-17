import { IClothingItem, UserPreferences } from '@/lib/types';

/**
 * Adjust user preferences based on feedback for outfit items
 * @param currentPreferences - Current user preferences
 * @param outfitItems - Items in the outfit that was rated
 * @param isLiked - Whether the user liked the outfit
 * @returns Updated user preferences
 */
export function adjustPreferencesBasedOnFeedback(
  currentPreferences: UserPreferences,
  outfitItems: IClothingItem[],
  isLiked: boolean
): UserPreferences {
  const updatedPreferences: UserPreferences = {
    ...currentPreferences,
    styles: currentPreferences.styles ? [...currentPreferences.styles] : [],
    colors: currentPreferences.colors ? [...currentPreferences.colors] : [],
    temperature_sensitivity: currentPreferences.temperature_sensitivity || 0,
  };

  // Adjust style preferences
  outfitItems.forEach(item => {
    if (item.style_tags) {
      item.style_tags.forEach(style => {
        if (isLiked) {
          // Add or increase weight of liked styles
          if (!updatedPreferences.styles?.includes(style)) {
            updatedPreferences.styles?.push(style);
          }
        } else {
          // Remove disliked styles
          const index = updatedPreferences.styles?.indexOf(style);
          if (index !== undefined && index > -1) {
            updatedPreferences.styles?.splice(index, 1);
          }
        }
      });
    }

    // Adjust color preferences
    if (item.color) {
      if (isLiked) {
        if (!updatedPreferences.colors?.includes(item.color)) {
          updatedPreferences.colors?.push(item.color);
        }
      } else {
        const index = updatedPreferences.colors?.indexOf(item.color);
        if (index !== undefined && index > -1) {
          updatedPreferences.colors?.splice(index, 1);
        }
      }
    }
  });

  return updatedPreferences;
}
