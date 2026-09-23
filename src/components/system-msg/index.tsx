import React from 'react';
import { RetroWindow } from '@/components/retro-ui';
import { Activity, Database, Calendar } from 'lucide-react';

import Link from 'next/link';

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
    const [timeStr, setTimeStr] = React.useState<string>('--:--');

    React.useEffect(() => {
        const updateTime = () => {
            setTimeStr(
                new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                })
            );
        };
        updateTime();
        const interval = setInterval(updateTime, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <RetroWindow
            title="CLOSET STATUS"
            className="h-full"
            headerColor="bg-[var(--accent-green)]"
            icon={<Activity size={12} />}
            collapsible
        >
            <div className="h-full flex flex-col font-mono text-xs space-y-3 bg-[var(--bg-secondary)] p-2 sm:p-2.5">

                {/* Status Header */}
                <div className="flex items-center justify-between border-b border-[var(--border)] border-dashed pb-2">
                    <span suppressHydrationWarning className="text-[var(--text-muted)] font-bold">{timeStr}</span>
                    <span className="text-[var(--status-online)] font-bold flex items-center gap-1.5 bg-[var(--status-online-bg)] px-2 py-0.5 border border-[var(--status-online)] text-[10px]">
                        <span className="w-2 h-2 bg-[var(--status-online)] rounded-full animate-pulse"></span>
                        ONLINE
                    </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                    <Link href="/wardrobe" className="bg-[var(--bg-tertiary)] border-2 border-[var(--border)] p-2 shadow-[2px_2px_0px_0px_var(--border)] hover:bg-[var(--accent-yellow)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all block">
                        <div className="flex items-center gap-1 text-[var(--text-muted)] mb-1">
                            <Database size={10} />
                            <span className="text-[10px] font-bold">WARDROBE</span>
                        </div>
                        <span className="text-lg font-bold text-[var(--text)]">{itemCount}</span>
                        <span className="text-[var(--text-muted)] text-[10px]"> {itemCount === 1 ? 'item' : 'items'}</span>
                    </Link>

                    <Link href="/history" className="bg-[var(--bg-tertiary)] border-2 border-[var(--border)] p-2 shadow-[2px_2px_0px_0px_var(--border)] hover:bg-[var(--accent-yellow)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all block">
                        <div className="flex items-center gap-1 text-[var(--text-muted)] mb-1">
                            <Calendar size={10} />
                            <span className="text-[10px] font-bold">LOGGED</span>
                        </div>
                        <span className="text-lg font-bold text-[var(--text)]">{outfitCount}</span>
                        <span className="text-[var(--text-muted)] text-[10px]"> {outfitCount === 1 ? 'outfit' : 'outfits'}</span>
                    </Link>
                </div>

                {/* Info Lines */}
                <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Season:</span>
                        <span className="text-[var(--text)] font-bold">{currentSeason}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Last Outfit:</span>
                        <span suppressHydrationWarning className="text-[var(--text)]">{formatRelativeTime(lastOutfitDate)}</span>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="mt-auto pt-2 border-t border-[var(--border)] border-dashed">
                    <div className="flex items-center gap-2 text-[var(--text-muted)]">
                        <span className="w-1.5 h-1.5 bg-[var(--status-online)] rounded-full"></span>
                        <span className="font-bold text-[10px] text-[var(--text)]">Closet synced & ready</span>
                    </div>
                </div>
            </div>
        </RetroWindow>
    );
};
