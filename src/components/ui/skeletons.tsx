import React from 'react';
import { RetroCard, RetroBox } from '@/components/retro-ui';

export const OutfitSkeleton = () => (
    <div className="h-full flex flex-col relative animate-pulse border-2 border-[var(--border)] bg-[var(--bg-secondary)] shadow-[4px_4px_0px_0px_var(--border)]">
        {/* Header */}
        <div className="bg-[var(--accent-pink)] border-b-2 border-[var(--border)] px-3 py-2 flex justify-between items-center">
            <div className="h-4 w-32 bg-black/20 rounded"></div>
            <div className="flex gap-1">
                <div className="w-5 h-5 bg-black/20 border border-black/30"></div>
                <div className="w-5 h-5 bg-black/20 border border-black/30"></div>
                <div className="w-5 h-5 bg-black/20 border border-black/30"></div>
            </div>
        </div>

        {/* Status Bar */}
        <div className="flex flex-row justify-between items-center bg-white border-b-2 border-[var(--border)] p-2 gap-2">
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
            <div className="h-6 w-12 bg-[var(--accent-pink)]/30 rounded"></div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 bg-[#f0f0f0] relative p-4 flex items-center justify-center min-h-[350px]">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>

            <div className="relative z-10 grid grid-cols-[80px_1fr_90px] gap-4 items-center w-full h-full">
                {/* Left - Accessories */}
                <div className="h-full border-2 border-black/10 bg-black/5 rounded-lg p-2 flex flex-col gap-3 justify-center">
                    <div className="w-14 h-14 bg-gray-200 border-2 border-black/10 self-center"></div>
                    <div className="w-14 h-14 bg-gray-200 border-2 border-black/10 self-center"></div>
                </div>

                {/* Center - Core Items */}
                <div className="flex flex-col gap-3 items-center w-full">
                    <div className="w-full max-w-[180px]">
                        <div className="w-full aspect-square bg-gray-200 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"></div>
                        <div className="h-6 bg-black/80 border-2 border-black border-t-0"></div>
                    </div>
                    <div className="w-full max-w-[180px]">
                        <div className="w-full aspect-[4/5] bg-gray-200 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"></div>
                        <div className="h-6 bg-black/80 border-2 border-black border-t-0"></div>
                    </div>
                </div>

                {/* Right - Layer & Shoes */}
                <div className="flex flex-col h-full justify-between py-4 items-end">
                    <div className="flex flex-col items-end gap-1">
                        <div className="w-20 h-20 bg-gray-200 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)]"></div>
                        <div className="h-4 w-20 bg-black/80 border-2 border-black border-t-0"></div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="w-24 h-24 bg-gray-200 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)]"></div>
                        <div className="h-4 w-24 bg-black/80 border-2 border-black border-t-0"></div>
                    </div>
                </div>
            </div>
        </div>

        {/* Logic Gate */}
        <div className="bg-[#e5e5e5] border-t-2 border-[var(--border)]">
            <div className="p-2 bg-white flex items-center gap-2">
                <div className="h-4 w-4 bg-gray-300 rounded"></div>
                <div className="h-4 w-28 bg-gray-200 rounded"></div>
            </div>
        </div>

        {/* Footer Controls */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--bg-secondary)]">
            <div className="h-12 bg-gray-200 border-2 border-[var(--border)]"></div>
            <div className="h-12 bg-gray-200 border-2 border-[var(--border)]"></div>
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
