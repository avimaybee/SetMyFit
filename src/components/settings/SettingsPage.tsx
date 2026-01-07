import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton, RetroSlider, RetroToggle } from '@/components/retro-ui';
import { Sliders, User, Database, LogOut, Monitor } from 'lucide-react';
import { UserPreferences } from '@/types/retro';

interface SettingsPageProps {
    onLogout: () => void;
    preferences: UserPreferences;
    onUpdate: (prefs: Partial<UserPreferences>) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onLogout, preferences, onUpdate }) => {
    // Local state for slider to prevent toast spam during dragging
    const [localRepeatInterval, setLocalRepeatInterval] = useState(preferences.repeat_interval || 0);
    const pendingUpdateRef = useRef<number | null>(null);

    // Sync local state when preferences change from outside
    useEffect(() => {
        setLocalRepeatInterval(preferences.repeat_interval || 0);
    }, [preferences.repeat_interval]);

    // Save the slider value when user finishes sliding
    const handleSliderCommit = () => {
        if (pendingUpdateRef.current !== null && pendingUpdateRef.current !== preferences.repeat_interval) {
            onUpdate({ repeat_interval: pendingUpdateRef.current });
        }
        pendingUpdateRef.current = null;
    };

    return (
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

            {/* Algorithm Tuning */}
            <RetroWindow title="ALGORITHM_TUNING.CFG" icon={<Sliders size={14} />}>
                <div className="space-y-6 p-4">
                    <div className="bg-[var(--accent-yellow)] border border-[var(--border)] p-3 text-xs font-mono text-[var(--text)]">
                        These settings control how the AI selects outfits from your wardrobe.
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold font-mono text-xs uppercase text-[var(--text)]">
                                Repeat Avoidance
                            </label>
                            <span className="font-mono text-sm font-bold text-[var(--text)] bg-[var(--bg-secondary)] px-2 py-1 border border-[var(--border)]">
                                {localRepeatInterval} days
                            </span>
                        </div>
                        <RetroSlider
                            label=""
                            min="0" max="30"
                            value={localRepeatInterval}
                            onChange={(e) => {
                                const value = parseInt(e.target.value);
                                setLocalRepeatInterval(value);
                                pendingUpdateRef.current = value;
                            }}
                            onMouseUp={handleSliderCommit}
                            onTouchEnd={handleSliderCommit}
                            minLabel="0 days" maxLabel="30 days"
                        />
                        <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                            Avoid suggesting items worn within this many days
                        </p>
                    </div>
                </div>
            </RetroWindow>

            {/* User Profile */}
            <RetroWindow title="USER_PROFILE" icon={<User size={14} />}>
                <div className="p-4 space-y-6">
                    <div>
                        <label className="font-bold font-mono text-xs uppercase mb-2 block text-[var(--text)]">Gender Context</label>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] mb-2">
                            Helps AI understand fit and styling preferences
                        </p>
                        <div className="flex border-2 border-[var(--border)] bg-[var(--bg-secondary)]">
                            {(['MASC', 'FEM', 'NEUTRAL'] as const).map(g => (
                                <button
                                    key={g}
                                    onClick={() => onUpdate({ gender: g })}
                                    className={`flex-1 py-3 font-mono text-xs font-bold hover:bg-gray-100/10 transition-colors ${preferences.gender === g ? 'bg-[var(--accent-pink)] text-[var(--text)]' : 'text-gray-500'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </RetroWindow>

            {/* Display Settings */}
            <RetroWindow title="DISPLAY_SETTINGS" icon={<Monitor size={14} />}>
                <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <span className="font-mono text-sm font-bold text-[var(--text)]">HACKER MODE</span>
                            <p className="text-[10px] font-mono text-[var(--text-muted)]">High-contrast terminal visuals</p>
                        </div>
                        <RetroToggle
                            label=""
                            checked={preferences.theme === 'HACKER'}
                            onChange={(c) => onUpdate({ theme: c ? 'HACKER' : 'RETRO' })}
                        />
                    </div>
                </div>
            </RetroWindow>

            {/* System */}
            <RetroWindow title="SYSTEM" icon={<Database size={14} />}>
                <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center font-mono text-xs">
                        <span className="text-[var(--text)]">Database Status</span>
                        <span className="text-[var(--accent-green)] font-bold">● ONLINE</span>
                    </div>
                    <div className="flex justify-between items-center font-mono text-xs">
                        <span className="text-[var(--text)]">Version</span>
                        <span className="text-[var(--text-muted)]">v2.0.0</span>
                    </div>
                    <div className="pt-4 border-t-2 border-[var(--border)] border-dashed">
                        <RetroButton variant="danger" className="w-full flex items-center justify-center gap-2" onClick={onLogout}>
                            <LogOut size={14} />
                            SIGN OUT
                        </RetroButton>
                    </div>
                </div>
            </RetroWindow>
        </div>
    );
};
