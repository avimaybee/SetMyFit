export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter' | 'All Season';
export type ClothingType = 'Top' | 'Bottom' | 'Shoes' | 'Outerwear' | 'Accessory' | 'Dress';
export type ClothingMaterial = 'Cotton' | 'Polyester' | 'Wool' | 'Silk' | 'Leather' | 'Denim' | 'Linen' | 'Synthetic' | 'Gore-Tex' | 'Other';
export type DressCode = 'Casual' | 'Business Casual' | 'Formal' | 'Sport' | 'Lounge' | 'Streetwear';

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingType;
  type: string;
  color: string;
  season_tags: string[]; // Keeping as string[] to be flexible with DB, or cast to Season[]
  style_tags: string[];
  image_url: string;
  material: string; // Keeping as string to be flexible
  insulation_value: number;
  dress_code: string[];
  wear_count: number;
  last_worn: string | null;
  is_favorite: boolean;
  created_at: string;
  pattern?: string;
  fit?: string;
  formality_insulation_value?: number;
}

export interface Outfit {
  id: string;
  outfit_date: string;
  items: ClothingItem[];
  weather_snapshot?: Record<string, unknown>;
  status?: string;
  feedback?: string;
  rating?: number;
  reasoning?: {
    weatherMatch?: string;
    totalInsulation?: number;
    historyCheck?: string;
    styleScore?: number;
    layeringStrategy?: string;
    colorAnalysis?: string;
    occasionFit?: string;
  };
}

export interface UserPreferences {
  styles?: string[];
  preferred_styles?: string[]; // New field
  colors?: string[];
  temperature_sensitivity?: number;
  variety_days?: number;
  repeat_interval?: number; // New field
  style_strictness?: number; // New field
  theme?: 'RETRO' | 'HACKER'; // New field
  gender?: 'MASC' | 'FEM' | 'NEUTRAL'; // New field
  preferred_silhouette?: string;
  preferred_color_palette?: string;
  default_preview_count?: number;
  delete_images_after_use?: boolean;
}

export interface OutfitTemplate {
    id: string;
    name: string;
    description: string;
    styleTags: string[];
    coverImage: string;
    requirements?: string[];
}
