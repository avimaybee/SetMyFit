import { WeatherData } from '@/lib/types';
import { serverEnv } from '@/lib/serverEnv';
import { getCurrentSeason, getSeasonDescription } from '@/lib/helpers/seasonDetector';
import { logger } from '@/lib/logger';

export interface ThermalComfortProfile {
  apparentTemperatureC: number;
  targetInsulationClo: number; // 0 (hot summer) to 10 (extreme arctic)
  recommendedLayers: number;   // 1 (base only), 2 (base + mid/outer), 3 (base + mid + heavy outer)
  precipitationDefense: boolean; // True if rain/snow expected: avoid suede/raw canvas, require jacket/boots
  weatherSummary: string;
}

/**
 * Fetch from Open-Meteo (100% free, open-source, zero API keys required).
 * Provides immediate fallback so environmental intelligence never fails even if OpenWeather is unconfigured.
 */
async function fetchOpenMeteoWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json() as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
      };
    };

    if (!data.current) return null;
    const c = data.current;

    // Interpret WMO weather code
    const isRain = c.weather_code >= 51 && c.weather_code <= 99;
    const weatherCondition = isRain
      ? 'Rain / Precipitation'
      : c.weather_code <= 3
        ? 'Clear to Partly Cloudy'
        : 'Overcast';

    return {
      temperature: c.temperature_2m,
      feels_like: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      wind_speed: c.wind_speed_10m,
      uv_index: 0,
      air_quality_index: 0,
      pollen_count: 0,
      weather_condition: weatherCondition,
      city: 'Local Area',
      timestamp: new Date(),
      is_mock: false,
    };
  } catch (err) {
    logger.warn('Open-Meteo fetch failed:', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Fetch from OpenWeather if API key is present.
 */
async function fetchOpenWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const apiKey = (await serverEnv('OPENWEATHER_API_KEY')) || process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      main: { temp: number; feels_like: number; humidity: number };
      wind?: { speed: number };
      weather?: Array<{ description: string }>;
      name?: string;
    };

    return {
      temperature: data.main.temp,
      feels_like: data.main.feels_like,
      humidity: data.main.humidity,
      wind_speed: data.wind?.speed ?? 0,
      uv_index: 0,
      air_quality_index: 0,
      pollen_count: 0,
      weather_condition: data.weather?.[0]?.description ?? 'Clear',
      city: data.name || 'Local Area',
      timestamp: new Date(),
      is_mock: false,
    };
  } catch (err) {
    logger.warn('OpenWeather fetch failed:', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * 3-Tier Environmental Resolver:
 * Tier 1: Real-time Weather (OpenWeather or Open-Meteo zero-key fallback)
 * Tier 2: User Manual Override Context ("Chilly 10°C evening", "Tropical resort")
 * Tier 3: Hemispheric Season & Neutral Default (20°C)
 */
export async function resolveEnvironmentalContext(params: {
  lat?: number | null;
  lon?: number | null;
  userContext?: string;
}): Promise<{
  weather: WeatherData | null;
  thermalProfile: ThermalComfortProfile;
  seasonContext: string;
}> {
  let weather: WeatherData | null = null;

  if (typeof params.lat === 'number' && typeof params.lon === 'number') {
    weather = await fetchOpenWeather(params.lat, params.lon);
    if (!weather) {
      weather = await fetchOpenMeteoWeather(params.lat, params.lon);
    }
  }

  // Derive thermal comfort parameters
  const apparentTemp = weather?.feels_like ?? weather?.temperature ?? 20;
  const isPrecipitating = weather
    ? weather.weather_condition.toLowerCase().includes('rain') ||
      weather.weather_condition.toLowerCase().includes('snow') ||
      weather.weather_condition.toLowerCase().includes('drizzle')
    : false;

  // Calculate target insulation (0 to 10 scale)
  let targetInsulation = 5;
  let recommendedLayers = 1;

  if (apparentTemp < 5) {
    targetInsulation = 9;
    recommendedLayers = 3; // Base + mid (sweater/hoodie) + heavy coat
  } else if (apparentTemp < 12) {
    targetInsulation = 7;
    recommendedLayers = 2; // Base + jacket/overshirt
  } else if (apparentTemp < 18) {
    targetInsulation = 5;
    recommendedLayers = 2; // Base + light cardigan/jacket
  } else if (apparentTemp < 24) {
    targetInsulation = 3;
    recommendedLayers = 1; // Single breathable layer
  } else {
    targetInsulation = 1;
    recommendedLayers = 1; // Ultra-light summer wear
  }

  const thermalProfile: ThermalComfortProfile = {
    apparentTemperatureC: apparentTemp,
    targetInsulationClo: targetInsulation,
    recommendedLayers,
    precipitationDefense: isPrecipitating,
    weatherSummary: weather
      ? `${Math.round(apparentTemp)}°C, ${weather.weather_condition}, ${weather.humidity}% humidity`
      : params.userContext || 'Mild & comfortable indoor/outdoor day',
  };

  const currentSeason = getCurrentSeason(new Date(), params.lat ?? undefined);
  const seasonDescription = getSeasonDescription(currentSeason, new Date().getMonth());

  return {
    weather,
    thermalProfile,
    seasonContext: `${currentSeason} (${seasonDescription})`,
  };
}
