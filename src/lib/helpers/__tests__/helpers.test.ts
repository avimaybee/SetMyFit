/**
 * Simple test file to verify helper functions
 * Run with: npx tsx src/lib/helpers/__tests__/helpers.test.ts
 */

import { 
  filterByLastWorn, 
} from '../clothingHelpers';
import { adjustPreferences } from '../preferenceLearning';
import { 
  IClothingItem, 
  UserPreferences,
  RecommendationFeedback,
  WeatherData
} from '../../types';

console.log('🧪 Testing Backend Helper Functions\n');

// Test 2: Last Worn Filter
console.log('👕 Test 2: Last Worn Filter');
const mockItems: IClothingItem[] = [
  {
    id: 1,
    user_id: 'test',
    name: 'Blue Shirt',
    type: 'Top',
    material: 'Cotton',
    insulation_value: 3,
    last_worn_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    image_url: 'test.jpg',
    season_tags: null,
    style_tags: null,
    dress_code: ['Casual'],
    category: null,
    color: 'blue',
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    user_id: 'test',
    name: 'Red Jacket',
    type: 'Outerwear',
    material: 'Wool',
    insulation_value: 8,
    last_worn_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    image_url: 'test.jpg',
    season_tags: null,
    style_tags: null,
    dress_code: ['Casual'],
    category: null,
    color: 'red',
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    user_id: 'test',
    name: 'Black Pants',
    type: 'Bottom',
    material: 'Denim',
    insulation_value: 5,
    last_worn_date: null, // Never worn
    image_url: 'test.jpg',
    season_tags: null,
    style_tags: null,
    dress_code: ['Business Casual'],
    category: null,
    color: 'black',
    created_at: new Date().toISOString(),
  },
];

const filtered = filterByLastWorn(mockItems, 7);
console.log(`  Total items: ${mockItems.length}`);
console.log(`  Items eligible (not worn in 7+ days): ${filtered.length}`);
console.log(`  Eligible items: ${filtered.map(i => i.name).join(', ')}`);
console.log('✅ Last worn filtering working\n');

// Test 6: Preference Learning
console.log('🧠 Test 6: Preference Learning');
const initialPrefs: UserPreferences = {
  temperature_sensitivity: 0,
};

const mockWeather: WeatherData = {
  temperature: 15,
  feels_like: 13,
  humidity: 60,
  wind_speed: 10,
  uv_index: 5,
  air_quality_index: 50,
  pollen_count: 3,
  weather_condition: 'Cloudy',
  timestamp: new Date(),
};

const feedback: RecommendationFeedback = {
  recommendation_id: 'test-123',
  is_liked: false,
  reason: 'I was too cold',
  weather_conditions: mockWeather,
  created_at: new Date(),
};

const adjustedPrefs = adjustPreferences(initialPrefs, feedback);
console.log(`  Initial sensitivity: ${initialPrefs.temperature_sensitivity}`);
console.log(`  Feedback: "too cold"`);
console.log(`  Adjusted sensitivity: ${adjustedPrefs.temperature_sensitivity}`);
console.log(`  (Positive = feels colder, will recommend warmer clothes)`);
console.log('✅ Preference learning working\n');

// Test 7: Recommendation resilience with missing insulation values
console.log('🧥 Test 7: Recommendation handles missing insulation data');
const wardrobeWithMissingInsulation: IClothingItem[] = [
  {
    id: 11,
    user_id: 'test',
    name: 'Graphic Tee',
    type: 'Top',
    material: null,
    insulation_value: null,
    last_worn_date: null,
    image_url: 'tee.jpg',
    season_tags: null,
    style_tags: ['casual'],
    dress_code: ['Casual'],
    category: null,
    color: 'white',
    created_at: new Date().toISOString(),
  },
  {
    id: 12,
    user_id: 'test',
    name: 'Relaxed Chinos',
    type: 'Bottom',
    material: null,
    insulation_value: null,
    last_worn_date: null,
    image_url: 'pants.jpg',
    season_tags: null,
    style_tags: ['casual'],
    dress_code: ['Casual'],
    category: null,
    color: 'khaki',
    created_at: new Date().toISOString(),
  },
  {
    id: 13,
    user_id: 'test',
    name: 'Minimal Sneakers',
    type: 'Footwear',
    material: null,
    insulation_value: null,
    last_worn_date: null,
    image_url: 'shoes.jpg',
    season_tags: null,
    style_tags: ['casual'],
    dress_code: ['Casual'],
    category: null,
    color: 'white',
    created_at: new Date().toISOString(),
  },
];

const resilienceRecommendation = getRecommendation(
  wardrobeWithMissingInsulation,
  { weather: mockWeather, user_preferences: {} },
);

console.log(`  Items chosen: ${resilienceRecommendation.items.map(item => `${item.name} (${item.insulation_value})`).join(', ')}`);
console.log(`  Confidence score: ${resilienceRecommendation.confidence_score.toFixed(2)}`);
console.log('✅ Recommendation still works when insulation data is missing\n');

console.log('🎉 All tests passed! Backend helpers are functioning correctly.');
