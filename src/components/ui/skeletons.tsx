import React from 'react';
import { RetroCard, RetroBox } from '@/components/retro-ui';

export const WeatherSkeleton = () => (
    <RetroBox className="h-full flex flex-col justify-between relative overflow-hidden animate-pulse" color="bg-gray-200">
        <div className="flex justify-between items-start">
            <div className="h-6 w-24 bg-gray-300 mb-2"></div>
            <div className="h-8 w-8 bg-gray-300 border-2 border-black"></div>
        </div>
        <div className="flex items-end gap-4 mt-4">
            <div className="h-16 w-24 bg-gray-300"></div>
            <div className="flex flex-col gap-1 mb-2">
                <div className="h-4 w-16 bg-gray-300 border-2 border-black"></div>
                <div className="h-4 w-16 bg-gray-300 border-2 border-black"></div>
            </div>
        </div>
        <div className="mt-4 h-6 w-full bg-black/10"></div>
    </RetroBox>
);

export const OutfitSkeleton = () => (
    <div className="h-full flex flex-col relative animate-pulse">
        {/* Header */}
        <div className="flex flex-row justify-between items-center bg-white border-2 border-black p-2 mb-4 gap-2">
            <div className="h-4 w-32 bg-gray-200"></div>
            <div className="h-6 w-12 bg-gray-200 rounded-full"></div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 bg-[#f0f0f0] border-2 border-black relative p-4 flex items-center justify-center min-h-[400px]">
            <div className="grid grid-cols-[120px_1fr_120px] gap-4 items-center w-full h-full">
                {/* Left */}
                <div className="h-full border-2 border-black/10 bg-black/5 rounded-lg p-2 flex flex-col gap-2">
                    <div className="w-full aspect-square bg-gray-200 border-2 border-black/10"></div>
                    <div className="w-full aspect-square bg-gray-200 border-2 border-black/10"></div>
                    <div className="w-full aspect-square bg-gray-200 border-2 border-black/10"></div>
                </div>

                {/* Center */}
                <div className="flex flex-col gap-3 items-center w-full">
                    <div className="w-full max-w-[220px] aspect-square bg-gray-200 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)]"></div>
                    <div className="w-full max-w-[220px] aspect-[4/5] bg-gray-200 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)]"></div>
                </div>

                {/* Right */}
                <div className="flex flex-col h-full justify-between items-end">
                    <div className="w-24 h-24 bg-gray-200 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"></div>
                    <div className="w-28 h-28 bg-gray-200 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"></div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="h-12 bg-gray-200 border-2 border-black"></div>
            <div className="h-12 bg-gray-200 border-2 border-black"></div>
        </div>
    </div>
);

export const CardSkeleton = () => (
    <RetroCard className="flex flex-col h-full animate-pulse min-h-[280px]">
        <div className="aspect-square bg-gray-200 border-2 border-black/10 mb-2"></div>
        <div className="flex flex-col flex-1 gap-2">
            <div className="h-4 w-3/4 bg-gray-200"></div>
            <div className="h-3 w-1/2 bg-gray-200"></div>
            <div className="mt-auto flex gap-1">
                <div className="h-3 w-8 bg-gray-200 border border-black/10"></div>
                <div className="h-3 w-8 bg-gray-200 border border-black/10"></div>
            </div>
        </div>
    </RetroCard>
);

export const ListSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
        ))}
    </div>
);
