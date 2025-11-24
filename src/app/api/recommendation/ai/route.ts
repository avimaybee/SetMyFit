import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiResponse, IClothingItem, WeatherData } from '@/lib/types';
import { generateAIOutfitRecommendation } from '@/lib/helpers/aiOutfitAnalyzer';
import { filterByLastWorn } from '@/lib/helpers/clothingHelpers';
import { getCurrentSeason, getSeasonDescription } from '@/lib/helpers/seasonDetector';

/**
 * Fetch weather data from OpenWeatherMap API
 */
async function fetchWeatherData(lat: number, lon: number): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  if (!apiKey) {
    console.warn('OpenWeatherMap API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,daily&appid=${apiKey}&units=metric`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!response.ok) {
      console.error('Weather API error:', response.statusText);
      return null;
    }

    const data = await response.json();
    
    return {
      temperature: data.current.temp,
      feels_like: data.current.feels_like,
      humidity: data.current.humidity,
      wind_speed: data.current.wind_speed,
      uv_index: data.current.uvi || 0,
      air_quality_index: 0, // Would need separate API call
      pollen_count: 0, // Would need separate API call
      weather_condition: data.current.weather[0].description,
      timestamp: new Date(),
    } as WeatherData;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
}

/**
 * Format weather data for AI analysis
 */
function formatWeatherForAI(weather: WeatherData): string {
  const conditions: string[] = [
    `${Math.round(weather.temperature)}°C (feels like ${Math.round(weather.feels_like)}°C)`,
    weather.weather_condition,
    `${weather.humidity}% humidity`,
    `${Math.round(weather.wind_speed)} m/s wind`,
  ];

  if (weather.uv_index >= 6) {
    conditions.push(`High UV index (${weather.uv_index})`);
  }

  return conditions.join(', ');
}

/**
 * POST /api/recommendation/ai
 * Generate AI-powered outfit recommendation using Gemini 2.5 Flash
 * 
 * This endpoint:
 * 1. Fetches real weather data from OpenWeatherMap
 * 2. Analyzes clothing item descriptions
 * 3. Generates outfit combinations
 * 4. Validates combinations by analyzing actual images
 * 5. Replaces problematic items and re-validates
 * 6. Returns the best outfit with confidence score
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{
  outfit: IClothingItem[];
  validationScore: number;
  iterations: number;
  analysisLog: string[];
  reasoning: string;
  weatherData?: WeatherData;
}>>> {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { lat, lon, occasion, season } = body;

    // Validate required parameters
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Valid latitude and longitude are required' },
        { status: 400 }
      );
    }

    if (!occasion) {
      return NextResponse.json(
        { success: false, error: 'Occasion is required' },
        { status: 400 }
      );
    }

    // Fetch real weather data
    const weatherData = await fetchWeatherData(lat, lon);
    
    if (!weatherData) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch weather data. Please check OPENWEATHER_API_KEY.' },
        { status: 500 }
      );
    }

    // Detect current season based on date and latitude if not provided
    const currentSeason = season || getCurrentSeason(new Date(), lat);
    const seasonDescription = getSeasonDescription(currentSeason, new Date().getMonth());

    // Format weather for AI with season context
    const weatherDescription = formatWeatherForAI(weatherData);
    const weatherWithSeasonContext = `${weatherDescription}. IMPORTANT: It is currently ${seasonDescription}. Even though the temperature is ${Math.round(weatherData.temperature)}°C, consider the calendar season when selecting clothing - people typically dress for the season, not just the temperature.`;

    // Fetch user's wardrobe
    const { data: wardrobeItems, error: wardrobeError } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('user_id', user.id);

    if (wardrobeError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch wardrobe items' },
        { status: 500 }
      );
    }

    if (!wardrobeItems || wardrobeItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No clothing items found in wardrobe' },
        { status: 404 }
      );
    }

    // Filter by last worn date for variety
    const availableItems = filterByLastWorn(wardrobeItems as IClothingItem[]);

    if (availableItems.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Not enough clothing items available (need at least 3)' },
        { status: 400 }
      );
    }

    // Generate AI recommendation with real weather data and season context
    const aiResult = await generateAIOutfitRecommendation(
      availableItems,
      {
        weather: weatherWithSeasonContext,
        occasion: occasion,
        season: currentSeason,
      }
    );

    // Create reasoning from analysis log or structured reasoning
    let reasoning = aiResult.analysisLog.join('\n');
    
    if (aiResult.reasoning) {
      reasoning = `
Style Score: ${aiResult.reasoning.styleScore}/10
Weather Match: ${aiResult.reasoning.weatherMatch}
Color Analysis: ${aiResult.reasoning.colorAnalysis}
Layering: ${aiResult.reasoning.layeringStrategy}
Occasion Fit: ${aiResult.reasoning.occasionFit}
History Check: ${aiResult.reasoning.historyCheck}
      `.trim();
    }

    // Store recommendation in database
    const { data: _savedRecommendation, error: saveError } = await supabase
      .from('outfit_recommendations')
      .insert({
        user_id: user.id,
        outfit_items: aiResult.outfit.map(i => i.id),
        weather_data: { 
          temperature: weatherData.temperature,
          feels_like: weatherData.feels_like,
          weather_condition: weatherData.weather_condition,
          humidity: weatherData.humidity,
          wind_speed: weatherData.wind_speed,
          uv_index: weatherData.uv_index,
          occasion: occasion,
          season: season,
        },
        confidence_score: aiResult.validationScore / 100, // Convert to 0-1 scale
        reasoning: reasoning,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save recommendation:', saveError);
      // Continue anyway
    }

    return NextResponse.json({
      success: true,
      data: {
        outfit: aiResult.outfit,
        validationScore: aiResult.validationScore,
        iterations: aiResult.iterations,
        analysisLog: aiResult.analysisLog,
        reasoning: reasoning,
        weatherData: weatherData,
      },
      message: `AI generated outfit with ${aiResult.validationScore}/100 confidence after ${aiResult.iterations} iterations`,
    });
  } catch (error) {
    console.error('AI recommendation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error. Make sure Gemini API key is configured.' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendation/ai/validate
 * Validate an existing outfit combination using AI image analysis
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}>>> {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get item IDs from query params
    const searchParams = request.nextUrl.searchParams;
    const itemIdsParam = searchParams.get('item_ids');
    
    if (!itemIdsParam) {
      return NextResponse.json(
        { success: false, error: 'item_ids query parameter is required' },
        { status: 400 }
      );
    }

    const itemIds = itemIdsParam.split(',').map(id => parseInt(id, 10));

    // Fetch the items
    const { data: items, error: itemsError } = await supabase
      .from('clothing_items')
      .select('*')
      .in('id', itemIds)
      .eq('user_id', user.id);

    if (itemsError || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch clothing items' },
        { status: 404 }
      );
    }

    // Dynamically import to avoid issues
    const { validateOutfitImages } = await import('@/lib/helpers/aiOutfitAnalyzer');
    
    // Validate the outfit
    const validation = await validateOutfitImages(items as IClothingItem[]);

    return NextResponse.json({
      success: true,
      data: {
        isValid: validation.isValid,
        score: validation.score,
        issues: validation.issues,
        suggestions: validation.suggestions,
      },
    });
  } catch (error) {
    console.error('Outfit validation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
