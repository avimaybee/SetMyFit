import React from 'react';
import { RetroWindow, RetroButton, RetroSlider, RetroToggle } from '@/components/retro-ui';
import { Sliders, User, Database, LogOut, Monitor } from 'lucide-react';
import { UserPreferences } from '@/types/retro';

interface SettingsPageProps {
    onLogout: () => void;
    preferences: UserPreferences;
    onUpdate: (prefs: Partial<UserPreferences>) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onLogout, preferences, onUpdate }) => {
    const availableVibes = ['Streetwear', 'Vintage', 'Minimalist', 'Y2K', 'Gorpcore', 'Business', 'Techwear'];

    const toggleVibe = (vibe: string) => {
        const current = preferences.preferred_styles || [];
        if (current.includes(vibe)) {
            onUpdate({ preferred_styles: current.filter(v => v !== vibe) });
        } else {
            onUpdate({ preferred_styles: [...current, vibe] });
        }
    };

    return (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Algorithm Tuning Column */}
            <div className="flex flex-col gap-6">
                <RetroWindow title="ALGORITHM_TUNING.CFG" icon={<Sliders size={14} />}>
                    <div className="space-y-6 p-2">
                        <div className="bg-[var(--accent-yellow)] border border-[var(--border)] p-3 text-xs font-mono text-[var(--text)] mb-4">
                            Adjusting these values will directly impact the recommendation engine&apos;s output variance.
                        </div>

                        <RetroSlider 
                            label="Repeat Avoidance (Days)" 
                            min="0" max="30" 
                            value={preferences.repeat_interval || 0}
                            onChange={(e) => onUpdate({ repeat_interval: parseInt(e.target.value) })}
                            minLabel="Ignore" maxLabel="Strict"
                        />

                        <RetroSlider 
                            label="Style Flexibility" 
                            min="0" max="100" 
                            value={preferences.style_strictness || 50}
                            onChange={(e) => onUpdate({ style_strictness: parseInt(e.target.value) })}
                            minLabel="Rigid" maxLabel="Chaos"
                        />

                        <div className="border-t-2 border-[var(--border)] border-dashed pt-4">
                            <label className="font-bold font-mono text-xs uppercase mb-2 block text-[var(--text)]">Experimental Features</label>
                            <div className="space-y-2">
                                <RetroToggle label="Texture Matching AI" checked={true} onChange={()=>{}} />
                                <RetroToggle label="Color Theory Enforcement" checked={true} onChange={()=>{}} />
                            </div>
                        </div>
                    </div>
                </RetroWindow>

                <RetroWindow title="DISPLAY_SETTINGS" icon={<Monitor size={14} />}>
                     <div className="p-2 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-mono text-sm text-[var(--text)]">HACKER MODE</span>
                            <RetroToggle 
                                label="" 
                                checked={preferences.theme === 'HACKER'} 
                                onChange={(c) => onUpdate({ theme: c ? 'HACKER' : 'RETRO' })}
                            />
                        </div>
                        <p className="text-[10px] font-mono text-gray-500">Enables high-contrast terminal visuals.</p>
                     </div>
                </RetroWindow>
            </div>

            {/* Style Profile & Account Column */}
            <div className="flex flex-col gap-6">
                <RetroWindow title="USER_DNA_PROFILE" icon={<User size={14} />}>
                    <div className="p-2 space-y-6">
                        
                        <div>
                             <label className="font-bold font-mono text-xs uppercase mb-2 block text-[var(--text)]">Gender Context</label>
                             <div className="flex border-2 border-[var(--border)] bg-[var(--bg-secondary)]">
                                {(['MASC', 'FEM', 'NEUTRAL'] as const).map(g => (
                                    <button 
                                        key={g}
                                        onClick={() => onUpdate({ gender: g })}
                                        className={`flex-1 py-2 font-mono text-xs font-bold hover:bg-gray-100/10 ${preferences.gender === g ? 'bg-[var(--accent-pink)] text-[var(--text)]' : 'text-gray-500'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                             </div>
                        </div>

                        <div>
                            <label className="font-bold font-mono text-xs uppercase mb-2 block text-[var(--text)]">Active Aesthetics</label>
                            <div className="flex flex-wrap gap-2">
                                {availableVibes.map(vibe => (
                                    <button
                                        key={vibe}
                                        onClick={() => toggleVibe(vibe)}
                                        className={`
                                            px-2 py-1 text-xs font-mono border border-[var(--border)] transition-all
                                            ${preferences.preferred_styles?.includes(vibe) 
                                                ? 'bg-[var(--accent-yellow)] shadow-[2px_2px_0px_0px_var(--border)] font-bold text-[var(--text)]' 
                                                : 'bg-[var(--bg-secondary)] hover:bg-gray-100/10 text-gray-500'
                                            }
                                        `}
                                    >
                                        {vibe}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                             <label className="font-bold font-mono text-xs uppercase mb-2 block text-[var(--text)]">Core Vibe Description</label>
                             <textarea 
                                className="w-full h-24 border-2 border-[var(--border)] p-2 font-mono text-sm bg-[var(--bg-secondary)] text-[var(--text)] resize-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-pink)]"
                                placeholder="Describe your ideal style (e.g., '90s grunge meets modern utility')..."
                                defaultValue="Relaxed fits with a focus on utility and comfort. Prefer earth tones."
                             ></textarea>
                        </div>
                    </div>
                </RetroWindow>

                <RetroWindow title="SYSTEM_OPTS" icon={<Database size={14} />}>
                    <div className="p-2 space-y-4">
                        <div className="flex justify-between items-center font-mono text-xs">
                            <span className="text-[var(--text)]">Database Sync</span>
                            <span className="text-[var(--accent-green)] font-bold">ONLINE</span>
                        </div>
                        <div className="flex justify-between items-center font-mono text-xs">
                            <span className="text-[var(--text)]">Version</span>
                            <span className="text-gray-500">v1.0.6-beta</span>
                        </div>
                        <div className="pt-4 border-t-2 border-[var(--border)] border-dashed">
                            <RetroButton variant="danger" className="w-full flex items-center justify-center gap-2" onClick={onLogout}>
                                <LogOut size={14} />
                                DISCONNECT
                            </RetroButton>
                        </div>
                    </div>
                </RetroWindow>
            </div>
        </div>
    );
};

