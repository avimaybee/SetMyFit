import React from 'react';
import { CloudRain, Sun, Wind, Droplets } from 'lucide-react';
import { RetroBox } from '@/components/retro-ui';
// import { WeatherData } from '@/types'; // Use local interface for now or import if available

export interface WeatherData {
  temp: number;
  condition: string;
  city: string;
  humidity: number;
  wind: number;
}

interface WeatherWidgetProps {
  data: WeatherData;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ data }) => {
  return (
    <RetroBox className="h-full flex flex-col justify-between relative overflow-hidden" color="bg-[#A0C4FF]">
      
      {/* Decorative Background Sun */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full border-4 border-black bg-[#FDFFB6] z-0"></div>

      <div className="relative z-10 flex justify-between items-start">
        <div>
          <h3 className="font-bold text-xl uppercase font-mono border-b-2 border-black inline-block mb-1">{data.city}</h3>
          <p className="text-xs font-mono uppercase">Current Conditions</p>
        </div>
        <div className="bg-white border-2 border-black p-1">
          {data.condition === 'Sunny' ? <Sun size={24} className="text-black" /> : <CloudRain size={24} />}
        </div>
      </div>

      <div className="relative z-10 flex items-end gap-4 mt-4">
        <span className="text-6xl font-black drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] text-white stroke-black" 
              style={{ WebkitTextStroke: '2px black' }}>
          {data.temp}°
        </span>
        
        <div className="flex flex-col gap-1 mb-2">
           <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-0.5 text-xs font-bold">
              <Droplets size={12} />
              <span>{data.humidity}%</span>
           </div>
           <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-0.5 text-xs font-bold">
              <Wind size={12} />
              <span>{data.wind}m/s</span>
           </div>
        </div>
      </div>
      
      <div className="mt-4 bg-black text-white p-1 text-center font-mono text-xs">
        RECOMMENDATION ENGINE: ONLINE
      </div>
    </RetroBox>
  );
};
