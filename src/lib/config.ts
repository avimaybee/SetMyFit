/**
 * Centralized Configuration (Task 0.2)
 * 
 * This file manages all API keys, base URLs, and configuration variables
 * for the SetMyFit application.
 */

// ============================================================================
// Environment Variables Validation
// ============================================================================

const getEnvVar = (key: string, required = true): string => {
  const value = process.env[key];
  if (required && !value) {
    console.warn(`Warning: ${key} environment variable is not set`);
    return '';
  }
  return value || '';
};

// ============================================================================
// Firebase + Cloudflare Configuration
// ============================================================================

const getPublicEnv = (key: string): string => process.env[key] || '';

export const firebaseConfig = {
  apiKey: getPublicEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: getPublicEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: getPublicEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: getPublicEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getPublicEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getPublicEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
} as const;

export const storageConfig = {
  // Public base URL of the R2 bucket, e.g. https://pub-xxx.r2.dev
  publicUrl: getPublicEnv('R2_PUBLIC_URL') || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '',
  bucket: process.env.R2_BUCKET || 'setmyfit-images',
} as const;

// ============================================================================
// Weather API Configuration (Task 3.1)
// ============================================================================

export const weatherConfig = {
  // OpenWeatherMap API
  openWeather: {
    apiKey: getEnvVar('OPENWEATHER_API_KEY', false),
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    endpoints: {
      current: '/weather',
    },
  },

  // Default configuration
  defaultProvider: 'openWeather' as const,
  cacheDuration: 30 * 60 * 1000, // 30 minutes in milliseconds
} as const;

// ============================================================================
// AI/ML Configuration (Task 4.x)
// ============================================================================

export const aiConfig = {
  gemini: {
    apiKey: getEnvVar('GEMINI_API_KEY', false),
    // Frontier Stylist & Reasoning Engine
    model: getEnvVar('AI_STYLIST_MODEL', false) || 'gemini-3.5-flash-lite',
    // Micro-agent for fast vision ingestion, creative naming & tagging (Gemma 4 26B A4B MoE)
    microModel: getEnvVar('AI_MICRO_MODEL', false) || 'gemma-4-26b-a4b-it',
    // Frontier Dense fallback
    denseModel: getEnvVar('AI_DENSE_MODEL', false) || 'gemma-4-31b-it',
  },

  // Learning parameters
  learning: {
    feedbackWeight: 0.1, // How much each feedback adjusts preferences
    minFeedbackCount: 5, // Minimum feedback before adjusting preferences
  },
} as const;

// ============================================================================
// Application Configuration
// ============================================================================

export const appConfig = {
  // Recommendation settings (Task 1.4)
  recommendations: {
    minDaysSinceWorn: 7, // Minimum days before suggesting an item again
    varietyBoost: true, // Prioritize less-worn items
    defaultConfidenceThreshold: 0.7,
  },

  // Weather alerts thresholds (Task 3.3)
  alerts: {
    uvIndex: {
      high: 7,
      veryHigh: 10,
    },
    aqi: {
      moderate: 50,
      unhealthy: 100,
      veryUnhealthy: 150,
    },
    pollen: {
      high: 7.3,
      veryHigh: 9.7,
    },
  },

  // Pagination defaults
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
} as const;

// ============================================================================
// API Endpoints (Internal)
// ============================================================================

export const apiEndpoints = {
  // Wardrobe endpoints (Task 1.2)
  wardrobe: {
    base: '/api/wardrobe',
    byId: (id: number) => `/api/wardrobe/${id}`,
  },

  // Outfit endpoints (Task 1.3)
  outfit: {
    log: '/api/outfit/log',
    create: '/api/outfit',
  },

  // Weather endpoints (Task 3.1)
  weather: {
    current: '/api/weather',
  },

  // Settings endpoints
  settings: {
    profile: '/api/settings/profile',
  },

  // Recommendation endpoints (Task 4.1)
  recommendations: {
    feedback: (id: string) => `/api/recommendation/${id}/feedback`,
  },
} as const;

// ============================================================================
// Export all configs
// ============================================================================

export const config = {
  firebase: firebaseConfig,
  storage: storageConfig,
  weather: weatherConfig,
  ai: aiConfig,
  app: appConfig,
  endpoints: apiEndpoints,
} as const;

export default config;
