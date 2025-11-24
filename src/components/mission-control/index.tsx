import React from 'react';
import { RetroWindow } from '@/components/retro-ui';
import { Briefcase, Heart, Plane, Coffee, Crosshair, Sliders } from 'lucide-react';

interface MissionControlProps {
    selectedOccasion: string;
    onOccasionChange: (occasion: string) => void;
    lockedCount: number;
}

export const MissionControl: React.FC<MissionControlProps> = ({ selectedOccasion, onOccasionChange, lockedCount }) => {
  return (
    <RetroWindow title="MISSION_CTRL" icon={<Sliders size={14} />} className="h-full" headerColor="bg-[var(--accent-pink)]">
        <div className="p-3 space-y-4 h-full flex flex-col">
            
            {/* Occasion Selector */}
            <div>
                <p className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase mb-2 border-b border-[var(--border)] border-dashed pb-1">
                    Mission Profile
                </p>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'Work', icon: Briefcase },
                        { id: 'Date', icon: Heart },
                        { id: 'Travel', icon: Plane },
                        { id: 'Casual', icon: Coffee }
                    ].map((occ) => {
                        const Icon = occ.icon;
                        const isActive = selectedOccasion === occ.id;
                        return (
                            <button 
                                key={occ.id}
                                onClick={() => onOccasionChange(isActive ? '' : occ.id)}
                                className={`
                                    flex items-center gap-2 px-3 py-2 border-2 border-[var(--border)] text-xs font-mono font-bold transition-all
                                    ${isActive 
                                        ? 'bg-[var(--text)] text-[var(--bg-main)] shadow-[2px_2px_0px_0px_var(--border)]' 
                                        : 'bg-[var(--bg-secondary)] text-[var(--text)] hover:bg-[var(--accent-yellow)]'
                                    }
                                `}
                            >
                                <Icon size={12} /> {occ.id}
                            </button>
                        )
                    })}
                </div>
                {!selectedOccasion && (
                    <div className="mt-2 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-main)] p-1 border border-[var(--border)] text-center">
                        DEFAULT: GENERAL PURPOSE
                    </div>
                )}
            </div>

            {/* Constraints Display */}
            <div className="mt-auto">
                 <p className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase mb-2 border-b border-[var(--border)] border-dashed pb-1">
                    Active Constraints
                </p>
                <div className="flex items-center justify-between bg-[var(--bg-tertiary)] p-2 border-2 border-[var(--border)]">
                    <div className="flex items-center gap-2">
                        <Crosshair size={16} className={lockedCount > 0 ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)]"} />
                        <span className="font-mono text-xs font-bold text-[var(--text)]">LOCKED ITEMS</span>
                    </div>
                    <span className={`font-mono text-sm font-black ${lockedCount > 0 ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)]"}`}>
                        {lockedCount}
                    </span>
                </div>
            </div>

        </div>
    </RetroWindow>
  );
};
