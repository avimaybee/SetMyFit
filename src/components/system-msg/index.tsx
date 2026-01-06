import React from 'react';
import { RetroWindow } from '@/components/retro-ui';
import { Terminal, Database, Clock, Calendar } from 'lucide-react';

interface SystemMsgProps {
    logs?: { message: string; ts: string }[];
    itemCount?: number;
    outfitCount?: number;
    lastOutfitDate?: string | null;
    season?: string;
}

const formatRelativeTime = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
};

const getCurrentSeason = (): string => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'SPRING';
    if (month >= 5 && month <= 7) return 'SUMMER';
    if (month >= 8 && month <= 10) return 'AUTUMN';
    return 'WINTER';
};

export const SystemMsg: React.FC<SystemMsgProps> = ({
    itemCount = 0,
    outfitCount = 0,
    lastOutfitDate,
    season
}) => {
    const currentSeason = season || getCurrentSeason();
    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return (
        <RetroWindow
            title="SYSTEM_STATUS"
            className="h-full"
            headerColor="bg-[var(--accent-green)]"
            icon={<Terminal size={12} />}
        >
            <div className="p-3 h-full flex flex-col font-mono text-xs space-y-3 bg-[var(--bg-secondary)]">

                {/* Status Header */}
                <div className="flex items-center justify-between border-b border-[var(--border)] border-dashed pb-2">
                    <span className="text-[var(--text-muted)]">{timestamp}</span>
                    <span className="text-[var(--accent-green)] font-bold flex items-center gap-1">
                        <span className="w-2 h-2 bg-[var(--accent-green)] rounded-full animate-pulse"></span>
                        ONLINE
                    </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] p-2">
                        <div className="flex items-center gap-1 text-[var(--text-muted)] mb-1">
                            <Database size={10} />
                            <span>WARDROBE</span>
                        </div>
                        <span className="text-lg font-bold text-[var(--text)]">{itemCount}</span>
                        <span className="text-[var(--text-muted)]"> items</span>
                    </div>

                    <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] p-2">
                        <div className="flex items-center gap-1 text-[var(--text-muted)] mb-1">
                            <Calendar size={10} />
                            <span>LOGGED</span>
                        </div>
                        <span className="text-lg font-bold text-[var(--text)]">{outfitCount}</span>
                        <span className="text-[var(--text-muted)]"> outfits</span>
                    </div>
                </div>

                {/* Info Lines */}
                <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Season:</span>
                        <span className="text-[var(--text)] font-bold">{currentSeason}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Last Outfit:</span>
                        <span className="text-[var(--text)]">{formatRelativeTime(lastOutfitDate)}</span>
                    </div>
                </div>

                {/* Terminal Cursor */}
                <div className="mt-auto pt-2 border-t border-[var(--border)] border-dashed">
                    <div className="flex items-center gap-1 text-[var(--text-muted)]">
                        <span className="text-[var(--accent-green)]">&gt;</span>
                        <span>Ready for input</span>
                        <span className="animate-pulse font-bold text-[var(--text)]">_</span>
                    </div>
                </div>
            </div>
        </RetroWindow>
    );
};
