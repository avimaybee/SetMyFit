import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WeatherData, WeatherAlert, ApiResponse } from '@/lib/types';
import { config } from '@/lib/config';
import { validateQuery, weatherRequestSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';

/**
 * OpenWeather Current Weather API Response (Free Tier)
 * Endpoint: /data/2.5/weather
 */
interface OpenWeatherCurrentResponse {
  coord: { lon: number; lat: number };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility: number;
  wind: { speed: number; deg: number; gust?: number };
  clouds: { all: number };
  dt: number;
  sys: { country: string; sunrise: number; sunset: number };
  timezone: number;
  id: number;
  name: string;
}

/**
 * Generate weather alerts based on conditions
 */
function generateWeatherAlerts(weather: WeatherData): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  // UV Index check
  if (weather.uv_index >= config.app.alerts.uvIndex.veryHigh) {
    alerts.push({
      type: 'UV',
      severity: 'high',
      message: 'Very high UV index detected',
      recommendation: 'Wear a brimmed hat and sunglasses. Consider sunscreen.',
    });
  } else if (weather.uv_index >= config.app.alerts.uvIndex.high) {
    alerts.push({
      type: 'UV',
      severity: 'moderate',
      message: 'High UV index detected',
      recommendation: 'Consider wearing a hat or sunglasses for extended outdoor exposure.',
    });
  }

  // AQI check
  if (weather.air_quality_index >= config.app.alerts.aqi.veryUnhealthy) {
    alerts.push({
      type: 'AQI',
      severity: 'high',
      message: 'Very unhealthy air quality',
      recommendation: 'Wear outerwear with a hood or a light scarf to minimize exposure.',
    });
  } else if (weather.air_quality_index >= config.app.alerts.aqi.unhealthy) {
    alerts.push({
      type: 'AQI',
      severity: 'moderate',
      message: 'Unhealthy air quality for sensitive groups',
      recommendation: 'Consider covering up if you have respiratory sensitivities.',
    });
  }

  return alerts;
}

/**
 * GET /api/weather
 * Fetch current weather using OpenWeather free tier API
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ weather: WeatherData; alerts: WeatherAlert[] }>>> {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Validate query parameters
    const { lat, lon } = validateQuery(request, weatherRequestSchema) as { lat: number; lon: number };

    if (process.env.NODE_ENV === 'development') {
      console.log('📍 Weather API called with coords:', { lat, lon });
    }

    const weatherPayload = await fetchWeatherData(lat, lon);

    if (process.env.NODE_ENV === 'development') {
      console.log('✓ Weather data fetched:', {
        temperature: weatherPayload.weather.temperature,
        city: weatherPayload.weather.city,
        isMock: weatherPayload.weather.is_mock,
      });
    }

    return NextResponse.json({
      success: true,
      data: weatherPayload,
      message: weatherPayload.weather.is_mock ? 'Mock weather data (API key missing)' : 'Weather data from OpenWeather',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Weather API error', { error });

    return NextResponse.json(
      { success: false, error: `Failed to fetch weather data: ${errorMsg}` },
      { status: 500 }
    );
  }
}

/**
 * Fetch weather data from OpenWeather free tier API
 * Uses /data/2.5/weather endpoint (free - 1M calls/month)
 */
async function fetchWeatherData(
  lat: number,
  lon: number
): Promise<{ weather: WeatherData; alerts: WeatherAlert[] }> {
  const apiKey = config.weather.openWeather.apiKey;

  // Check if API key is configured
  if (!apiKey) {
    console.warn('⚠️ OPENWEATHER_API_KEY is not set in .env.local - using mock data');
    return createMockWeatherData();
  }

  try {
    // Build API URL for free tier /weather endpoint
    const apiUrl = `${config.weather.openWeather.baseUrl}${config.weather.openWeather.endpoints.current}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    if (process.env.NODE_ENV === 'development') {
      console.log('🌤️ Fetching OpenWeather data from:', apiUrl.replace(apiKey, '***'));
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      cache: 'no-store' // Always fetch fresh data
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenWeather API error:', { status: response.status, body: errorText });
      console.error(`❌ OpenWeather API returned ${response.status}:`, errorText);
      return createMockWeatherData();
    }

    const data: OpenWeatherCurrentResponse = await response.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('✓ OpenWeather response received:', {
        city: data.name,
        temp: data.main.temp,
        condition: data.weather[0]?.description,
      });
    }

    const fetchedAt = new Date();

    const weatherData: WeatherData = {
      temperature: Math.round(data.main.temp),
      feels_like: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      wind_speed: Math.round(data.wind.speed * 3.6), // m/s to km/h
      uv_index: 0, // Not available in free tier
      air_quality_index: 0, // Fetched separately below
      pollen_count: 0,
      weather_condition: data.weather[0]?.description || 'Unknown',
      timestamp: fetchedAt,
      fetched_at: fetchedAt.toISOString(),
      provider: 'openWeather',
      is_mock: false,
      city: data.name,
    };

    // Optionally fetch AQI (separate free endpoint)
    try {
      const aqiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
      const aqiResponse = await fetch(aqiUrl, { cache: 'no-store' });

      if (aqiResponse.ok) {
        const aqiData = await aqiResponse.json();
        const aqiIndex = aqiData.list?.[0]?.main?.aqi || 1;
        // Convert 1-5 scale to approximate 0-500 AQI scale
        weatherData.air_quality_index = aqiIndex * 50;
      }
    } catch (aqiError) {
      // AQI is optional, don't fail if it errors
      logger.error('AQI fetch error (non-critical)', { error: aqiError });
    }

    const alerts = generateWeatherAlerts(weatherData);

    return { weather: weatherData, alerts };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Weather API request timed out');
    } else {
      logger.error('OpenWeather fetch error', { error });
      console.error('❌ Weather fetch failed:', error);
    }
    return createMockWeatherData();
  }
}

/**
 * Create mock weather data for fallback
 */
function createMockWeatherData(): { weather: WeatherData; alerts: WeatherAlert[] } {
  const hour = new Date().getHours();
  const isDay = hour > 6 && hour < 18;
  const fetchedAt = new Date();

  const weather: WeatherData = {
    temperature: isDay ? 22 : 18,
    feels_like: isDay ? 22 : 18,
    humidity: 50,
    wind_speed: 10,
    uv_index: isDay ? 5 : 0,
    air_quality_index: 50,
    pollen_count: 2,
    weather_condition: isDay ? 'Sunny' : 'Clear',
    timestamp: fetchedAt,
    fetched_at: fetchedAt.toISOString(),
    provider: 'mock',
    is_mock: true,
    city: 'Demo Location',
  };

  return { weather, alerts: [] };
}
