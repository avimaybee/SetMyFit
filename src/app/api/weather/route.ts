import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WeatherData, WeatherAlert, ApiResponse } from '@/lib/types';
import { config } from '@/lib/config';
import { validateQuery, weatherRequestSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';

// Types for OpenWeather hourly payload (subset used by the app)
interface OpenWeatherHourly {
  dt: number; // unix timestamp
  temp: number;
  feels_like?: number;
  humidity?: number;
  wind_speed?: number;
  weather?: Array<{
    id?: number;
    main?: string;
    description?: string;
    icon?: string;
  }>;
}

// Normalized hourly forecast item returned by our API
interface HourlyForecastItem {
  timestamp: string; // ISO timestamp
  temperature: number;
  weather_condition: string;
  condition: string;
  feels_like?: number;
  humidity?: number;
  wind_speed?: number;
}

function calculateFeelsLike(
  temp: number,
  humidity: number,
  windSpeed: number
): number {
  // Use heat index for temperatures above 80°F (27°C)
  if (temp >= 27) {
    // Simplified heat index formula
    const hi = -8.78469475556 +
      1.61139411 * temp +
      2.33854883889 * humidity +
      -0.14611605 * temp * humidity +
      -0.012308094 * temp * temp +
      -0.0164248277778 * humidity * humidity +
      0.002211732 * temp * temp * humidity +
      0.00072546 * temp * humidity * humidity +
      -0.000003582 * temp * temp * humidity * humidity;
    return Math.round(hi * 10) / 10;
  }

  // Use wind chill for temperatures below 50°F (10°C)
  if (temp <= 10 && windSpeed > 3) {
    // Wind chill formula (metric)
    const wc = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) +
      0.3965 * temp * Math.pow(windSpeed, 0.16);
    return Math.round(wc * 10) / 10;
  }

  // For moderate temperatures, return actual temperature
  return temp;
}


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

  // Pollen check
  if (weather.pollen_count >= config.app.alerts.pollen.veryHigh) {
    alerts.push({
      type: 'Pollen',
      severity: 'high',
      message: 'Very high pollen count',
      recommendation: 'Wear outerwear with a hood or consider a face covering if you have allergies.',
    });
  } else if (weather.pollen_count >= config.app.alerts.pollen.high) {
    alerts.push({
      type: 'Pollen',
      severity: 'moderate',
      message: 'High pollen count',
      recommendation: 'Be aware if you have pollen allergies.',
    });
  }

  return alerts;
}


export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ weather: WeatherData; alerts: WeatherAlert[]; hourly_forecast?: HourlyForecastItem[] }>>> {
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
      console.log('✓ Weather data fetched successfully');
      console.log('📦 Weather API returning:', {
        hasWeather: !!weatherPayload.weather,
        temperature: weatherPayload.weather?.temperature,
        city: weatherPayload.weather?.city,
        condition: weatherPayload.weather?.weather_condition,
        fullPayload: weatherPayload,
      });
    }

    return NextResponse.json({
      success: true,
      data: weatherPayload,
      message: 'Weather data from OpenWeather',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Weather API error:', errorMsg);
    }
    logger.error('Weather API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}

/**
 * Fetch weather data from provider
 * Extracted to separate function for caching
 */
async function fetchWeatherData(
  lat: number,
  lon: number
): Promise<{ weather: WeatherData; alerts: WeatherAlert[]; hourly_forecast?: HourlyForecastItem[] }> {
  // Try to fetch real weather data
  let weatherData: WeatherData | null = null;
  let hourlyForecast: HourlyForecastItem[] = [];

  // OpenWeatherMap integration
  if (!config.weather.openWeather.apiKey) {
    console.warn('⚠️ OpenWeather API Key is MISSING in config. Check .env.local for OPENWEATHER_API_KEY or NEXT_PUBLIC_OPENWEATHER_API_KEY');
  }
  if (config.weather.openWeather.apiKey) {
    try {
      const apiUrl = `${config.weather.openWeather.baseUrl}${config.weather.openWeather.endpoints.onecall}?lat=${lat}&lon=${lon}&appid=${config.weather.openWeather.apiKey}&units=metric`;

      if (process.env.NODE_ENV === 'development') {
        console.log('🌤️  Fetching OpenWeather data...');
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        logger.error('OpenWeatherMap API error:', { status: response.status, body: text });
        if (process.env.NODE_ENV === 'development') {
          console.warn('OpenWeatherMap API returned non-OK response', { status: response.status });
        }
      } else {
        const data = await response.json();
        if (process.env.NODE_ENV === 'development') {
          console.log('✓ OpenWeather data received');
          // Log raw provider values for debugging unit/value mismatches
          console.log('🔍 OpenWeather raw values:', {
            provider_temp: data.current?.temp,
            provider_feels_like: data.current?.feels_like,
            provider_units: 'metric (requested via &units=metric)',
            provider_timestamp: data.current?.dt,
          });
        }

        const fetchedAt = new Date();
        weatherData = {
          temperature: data.current.temp,
          feels_like: data.current.feels_like,
          humidity: data.current.humidity,
          wind_speed: data.current.wind_speed * 3.6, // Convert m/s to km/h
          uv_index: data.current.uvi || 0,
          air_quality_index: 0,
          pollen_count: 0,
          weather_condition: data.current.weather[0]?.description || 'Unknown',
          timestamp: fetchedAt,
          fetched_at: fetchedAt.toISOString(),
          provider: 'openWeather',
          is_mock: false,
        };

        // Parse hourly forecast data
        if (data.hourly && Array.isArray(data.hourly)) {
          hourlyForecast = data.hourly.slice(0, 12).map((hour: OpenWeatherHourly) => ({
            timestamp: new Date(hour.dt * 1000).toISOString(),
            temperature: hour.temp,
            weather_condition: hour.weather?.[0]?.description || 'Unknown',
            condition: hour.weather?.[0]?.main || 'Unknown',
            feels_like: hour.feels_like,
            humidity: hour.humidity,
            wind_speed: hour.wind_speed ? hour.wind_speed * 3.6 : undefined,
          }));
        }

        // Fetch air quality data
        try {
          const aqiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${config.weather.openWeather.apiKey}`;
          const aqiResponse = await fetch(aqiUrl);
          if (aqiResponse.ok) {
            const aqiData = await aqiResponse.json();
            const aqiIndex = aqiData.list[0]?.main?.aqi || 1;
            weatherData.air_quality_index = aqiIndex * 50;
          }
        } catch (aqiError) {
          logger.error('AQI fetch error', { error: aqiError });
        }

        // Fetch city name via reverse geocoding
        try {
          const geoUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${config.weather.openWeather.apiKey}`;
          const geoResponse = await fetch(geoUrl);
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            if (geoData && geoData.length > 0) {
              weatherData.city = geoData[0].name;
            }
          }
        } catch (geoError) {
          logger.error('Geocoding fetch error', { error: geoError });
        }
      }
    } catch (error) {
      logger.error('OpenWeatherMap fetch error', { error });
    }
  }

  // Fallback to mock data if no real data available
  if (!weatherData) {
    console.warn('⚠️ No real weather data available — using mock fallback');

    // Debug: Check if API key is loaded
    const apiKey = config.weather.openWeather.apiKey;
    console.log('🔑 Weather API Key Status:', apiKey ? `Loaded (${apiKey.substring(0, 4)}...)` : 'MISSING');

    // Stable mock data (based on time of day to be slightly dynamic but consistent per refresh)
    const hour = new Date().getHours();
    const isDay = hour > 6 && hour < 18;

    const temperature = isDay ? 22 : 18; // Stable temp
    const humidity = 50;
    const windSpeed = 10;
    const fetchedAt = new Date();

    weatherData = {
      temperature: temperature,
      feels_like: temperature,
      humidity: humidity,
      wind_speed: windSpeed,
      uv_index: isDay ? 5 : 0,
      air_quality_index: 50,
      pollen_count: 2,
      weather_condition: isDay ? 'Sunny' : 'Clear',
      timestamp: fetchedAt,
      fetched_at: fetchedAt.toISOString(),
      provider: 'mock-fallback',
      is_mock: true,
    };

    // Generate mock hourly forecast
    const now = new Date();
    hourlyForecast = Array.from({ length: 12 }, (_, i) => {
      const hourTemp = temperature;
      const hourDate = new Date(now.getTime() + i * 60 * 60 * 1000);

      return {
        timestamp: hourDate.toISOString(),
        temperature: hourTemp,
        weather_condition: isDay ? 'Sunny' : 'Clear',
        condition: isDay ? 'Clear' : 'Clear',
        feels_like: hourTemp,
        humidity: humidity,
        wind_speed: windSpeed,
      };
    });
  }

  // Generate alerts based on weather conditions
  const alerts = generateWeatherAlerts(weatherData);

  return {
    weather: weatherData,
    alerts,
    hourly_forecast: hourlyForecast,
  };
}
