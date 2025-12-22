import React from 'react';
import {
  CloudRain,
  Sun,
  Wind,
  Droplets,
  Cloud,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Loader2
} from 'lucide-react';
import { RetroBox } from '@/components/retro-ui';

export interface WeatherData {
  temp: number;
  condition: string;
  city: string;
  humidity: number;
  wind: number;
}

interface WeatherWidgetProps {
  data: WeatherData;
  isLoading?: boolean;
}

/**
 * Map weather condition to appropriate icon
 */
function getWeatherIcon(condition: string) {
  const lowerCondition = condition.toLowerCase();

  if (lowerCondition.includes('thunder') || lowerCondition.includes('storm')) {
    return <CloudLightning size={24} className="text-black" />;
  }
  if (lowerCondition.includes('snow') || lowerCondition.includes('sleet')) {
    return <CloudSnow size={24} className="text-black" />;
  }
  if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle') || lowerCondition.includes('shower')) {
    return <CloudRain size={24} className="text-black" />;
  }
  if (lowerCondition.includes('fog') || lowerCondition.includes('mist') || lowerCondition.includes('haze')) {
    return <CloudFog size={24} className="text-black" />;
  }
  if (lowerCondition.includes('cloud') || lowerCondition.includes('overcast')) {
    return <Cloud size={24} className="text-black" />;
  }
  if (lowerCondition.includes('clear') || lowerCondition.includes('sunny')) {
    return <Sun size={24} className="text-black" />;
  }

  // Default to sun
  return <Sun size={24} className="text-black" />;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ data, isLoading = false }) => {
  // Loading state
  if (isLoading) {
    return (
      <RetroBox className="h-full flex items-center justify-center" color="bg-[#A0C4FF]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={32} className="animate-spin text-black" />
          <span className="font-mono text-xs">LOADING WEATHER...</span>
        </div>
      </RetroBox>
    );
  }

  // Check if this is mock/demo data
  const isMockData = data.city === 'Demo Location' || data.temp === 0;

  return (
    <RetroBox className="h-full flex flex-col justify-between relative overflow-hidden" color="bg-[#A0C4FF]">

      {/* Decorative Background Sun */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full border-4 border-black bg-[#FDFFB6] z-0"></div>

      <div className="relative z-10 flex justify-between items-start">
        <div>
          <h3 className="font-bold text-xl uppercase font-mono border-b-2 border-black inline-block mb-1">
            {data.city || 'Current Location'}
          </h3>
          <p className="text-xs font-mono uppercase">Current Conditions</p>
        </div>
        <div className="bg-white border-2 border-black p-1">
          {getWeatherIcon(data.condition)}
        </div>
      </div>

      <div className="relative z-10 flex items-end gap-4 mt-4">
        <span
          className="text-6xl font-black drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] text-white stroke-black"
          style={{ WebkitTextStroke: '2px black' }}
        >
          {data.temp}°
        </span>

        <div className="flex flex-col gap-1 mb-2">
          <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-0.5 text-xs font-bold">
            <Droplets size={12} />
            <span>{data.humidity}%</span>
          </div>
          <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-0.5 text-xs font-bold">
            <Wind size={12} />
            <span>⫿ {data.wind}m/s</span>
          </div>
        </div>
      </div>

      <div className={`mt-4 p-1 text-center font-mono text-xs ${isMockData ? 'bg-yellow-500 text-black' : 'bg-black text-white'}`}>
        {isMockData ? 'DEMO MODE - ADD API KEY' : 'RECOMMENDATION ENGINE: ONLINE'}
      </div>
    </RetroBox>
  );
};
