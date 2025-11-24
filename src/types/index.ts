/**
 * Type definitions for What2Wear UI
 * These interfaces align with the backend API data structures
 */

export type ClothingType = 
  | 'Outerwear'
  | 'Top'
  | 'Bottom'
  | 'Footwear'
  | 'Accessory'
  | 'Headwear';

export type ClothingMaterial = 
  | 'Cotton'
  | 'Wool'
  | 'Synthetic'
  | 'Gore-Tex'
  | 'Fleece'
  | 'Leather'
  | 'Denim'
  | 'Silk'
  | 'Linen'
  | 'Polyester'
  | 'Nylon';

export type DressCode = 
  | 'Casual'
  | 'Business Casual'
  | 'Formal'
  | 'Athletic'
  | 'Loungewear';

export interface IClothingItem {
  id: number;
  user_id: string;
  name: string;
  type: ClothingType;
  category: string; // Added to match schema
  material: string; // Changed to string for flexibility with AI-generated materials
  insulation_value: number;
  last_worn: string | null; // ISO Date String
  last_worn_date?: string | null; // Added to match schema
  last_used_date?: string | null; // Added to match schema
  image_url: string;
  color: string | null;
  season_tags: string[] | null;
  style_tags: string[] | null;
  dress_code: DressCode[] | string[]; // Allow string array for flexibility
  created_at: string;
  // Enhanced AI-generated properties for better outfit recommendations
  pattern?: string | null; // e.g., "Solid", "Striped", "Plaid"
  fit?: string | null; // e.g., "Slim Fit", "Regular Fit", "Loose Fit"
  style?: string | null; // e.g., "Modern", "Vintage", "Streetwear"
  occasion?: string[] | null; // e.g., ["Work", "Casual Outing"]
  description?: string | null; // Detailed AI description for outfit matching
  wear_count: number; // Added to match schema
  is_favorite: boolean; // Added to match schema
  tags: string[]; // Added to match schema
}

export interface IOutfit {
  id: number;
  user_id: string;
  outfit_date: string | null;
  rendered_image_url: string | null;
  feedback: number | null;
  created_at: string;
  reasoning: string | null;
  weather_data: Record<string, unknown> | null;
  visual_image_url: string | null;
  visual_metadata: Record<string, unknown> | null;
}

export interface IUserProfile {
  id: string;
  name: string | null;
  region: string | null;
  full_body_model_url: string | null;
  preferences: Record<string, unknown> | null;
  privacy_settings: Record<string, unknown> | null;
  style_preferences: Record<string, unknown> | null;
  gender: string | null;
}

export interface IDbUserPreferences {
  id: string;
  user_id: string;
  preferred_silhouette: string;
  preferred_styles: string[] | null;
  preferred_color_palette: string | null;
  saved_style_presets: Record<string, unknown>[] | null;
  default_preview_count: number;
  default_preview_quality: string;
  consent_to_generate: boolean;
  delete_images_after_use: boolean;
  created_at: string;
  updated_at: string;
}

export interface IOutfitRecommendation {
  id: number;
  user_id: string;
  outfit_items: number[]; // bigint[]
  weather_data: Record<string, unknown> | null;
  confidence_score: number | null;
  reasoning: string | null;
  created_at: string;
  detailed_reasoning: string | null;
}

export interface IOutfitVisuals {
  id: string;
  user_id: string;
  recommendation_id: string | null;
  seed: number | null;
  style: string | null;
  prompt_text: string | null;
  preview_urls: string[] | null;
  final_urls: string[] | null;
  job_id: string | null;
  job_status: string; // outfit_generation_status
  job_error_message: string | null;
  preview_quality: string | null;
  item_ids: string[] | null;
  silhouette: string | null;
  created_at: string;
  preview_generated_at: string | null;
  final_generated_at: string | null;
  updated_at: string;
  retention_days: number;
  scheduled_deletion_at: string | null;
  user_opted_in_to_retain: boolean;
}

export interface IRecommendationFeedback {
  id: number;
  recommendation_id: number;
  user_id: string;
  is_liked: boolean | null;
  reason: string | null;
  created_at: string;
}

export interface IWardrobeAnalytics {
  user_id: string;
  total_items: number;
  favorite_count: number;
  avg_wear_count: number;
  max_wear_count: number;
  worn_last_30_days: number;
  rarely_worn: number;
}

export interface WeatherAlert {
  type: 'UV' | 'AQI' | 'Pollen';
  severity: 'low' | 'moderate' | 'high';
  message: string;
  recommendation?: string;
}

export interface IRecommendation {
  id: string;
  outfit: IClothingItem[];
  reasoning: string;
  constraint_alerts: string[];
  temp_feels_like: number;
  aqi: number;
  uv_index: number;
  pollen_count: number;
  dress_code?: DressCode;
  weather_alerts?: WeatherAlert[];
}

export interface UserPreferences {
  styles?: string[];
  colors?: string[];
  temperature_sensitivity?: number; // -2 (very cold) to +2 (very warm)
  variety_days?: number; // Days before recommending same item
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
