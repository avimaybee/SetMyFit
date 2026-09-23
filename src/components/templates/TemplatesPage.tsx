import React from 'react';
import { RetroWindow, RetroButton, RetroImage } from '@/components/retro-ui';
import { OutfitTemplate, ClothingItem } from '@/types/retro';
import { ArrowRight, Layers } from 'lucide-react';

interface TemplatesPageProps {
    templates: (OutfitTemplate & { requirements?: string[] })[];
    onApply: (template: OutfitTemplate) => void;
    userItems?: ClothingItem[];
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({ templates, onApply, userItems = [] }) => {
    const isRequirementSatisfied = (req: string) => {
        if (!userItems || userItems.length === 0) return false;
        const reqLower = req.toLowerCase();
        const words = reqLower.split(/[\s/]+/).filter(w => w.length > 2);
        return userItems.some(item => {
            const nameLower = (item.name || '').toLowerCase();
            const catLower = (item.category || item.type || '').toLowerCase();
            const tags = (item.style_tags || []).map(t => t.toLowerCase());
            return words.some(w => nameLower.includes(w) || catLower.includes(w) || tags.some(t => t.includes(w)));
        });
    };

    return (
        <RetroWindow title="STYLE TEMPLATES" className="h-full" icon={<Layers size={14} />}>
            <div className="p-2">
                <div className="bg-[var(--accent-blue)] border-2 border-[var(--border)] p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4 shadow-[4px_4px_0px_0px_var(--border)]">
                    <div className="bg-[var(--bg-secondary)] p-2 border-2 border-[var(--border)] rounded-full">
                         <Layers size={24} className="text-[var(--text)]" />
                    </div>
                    <div>
                        <h2 className="font-black text-xl mb-1 uppercase tracking-tight text-[var(--text)]">Template Library</h2>
                        <p className="font-mono text-xs text-[var(--text)] font-bold opacity-80">Select a preset to guide your next outfit.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {templates.map(template => {
                        const totalReqs = template.requirements?.length || 0;
                        const satisfiedCount = (template.requirements || []).filter(isRequirementSatisfied).length;
                        const isFullyReady = totalReqs > 0 && satisfiedCount === totalReqs;

                        return (
                            <div key={template.id} className="relative group">
                                <div className="relative z-10 bg-[var(--bg-secondary)] border-2 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] md:shadow-[6px_6px_0px_0px_var(--border)] h-full flex flex-col">
                                    <div className="border-b-2 border-[var(--border)] bg-[var(--bg-tertiary)] p-2 flex justify-between items-center relative overflow-hidden flex-wrap gap-2">
                                         {/* Dotted Background Pattern */}
                                         <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--text) 1px, transparent 1px)', backgroundSize: '8px 8px' }}></div>
                                         
                                         <div className="flex items-center gap-1.5 z-10 relative flex-wrap">
                                             <span className="font-mono text-xs font-bold px-1 text-[var(--text)]">PRESET</span>
                                             {userItems.length > 0 && totalReqs > 0 && (
                                                 isFullyReady ? (
                                                     <span className="font-mono text-[9px] bg-[var(--status-online)] text-white px-1.5 py-0.5 font-bold border border-[var(--border)]">
                                                         READY TO WEAR
                                                     </span>
                                                 ) : satisfiedCount > 0 ? (
                                                     <span className="font-mono text-[9px] bg-[var(--accent-yellow)] text-[var(--text)] px-1.5 py-0.5 font-bold border border-[var(--border)]">
                                                         {satisfiedCount}/{totalReqs} IN CLOSET
                                                     </span>
                                                 ) : null
                                             )}
                                         </div>
                                         <div className="flex flex-wrap gap-1 z-10 relative">
                                             {template.styleTags.map(tag => (
                                                 <span key={tag} className="text-[9px] border border-[var(--border)] px-1 bg-[var(--bg-main)] uppercase font-bold text-[var(--text)]">{tag}</span>
                                             ))}
                                         </div>
                                    </div>

                                    <div className="p-3 sm:p-4 flex-1 flex flex-col gap-3 sm:gap-4">
                                        <div className="flex gap-3 sm:gap-4 items-start">
                                            <div className="w-16 h-16 sm:w-24 sm:h-24 shrink-0 border-2 border-[var(--border)] bg-[var(--bg-main)]">
                                                <RetroImage 
                                                    src={template.coverImage} 
                                                    alt={template.name} 
                                                    containerClassName="w-full h-full border-0" 
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-black text-base sm:text-xl uppercase leading-tight mb-1 sm:mb-2 text-[var(--text)] truncate">{template.name}</h3>
                                                <p className="font-mono text-xs text-[var(--text-muted)] leading-snug line-clamp-2 sm:line-clamp-3">{template.description}</p>
                                            </div>
                                        </div>

                                        <div className="bg-[var(--bg-tertiary)] p-2 border border-[var(--border)] mt-auto">
                                            <span className="block font-mono text-[10px] font-bold uppercase mb-1 border-b border-[var(--border)] border-dashed pb-1 text-[var(--text-muted)]">Pieces Needed:</span>
                                            <ul className="list-none space-y-1.5">
                                                {(template.requirements || []).map((req, i) => {
                                                    const satisfied = isRequirementSatisfied(req);
                                                    return (
                                                        <li key={i} className="font-mono text-xs flex items-center justify-between gap-2 text-[var(--text)]">
                                                            <div className="flex items-center gap-2 truncate">
                                                                <div className={`w-1.5 h-1.5 ${satisfied ? 'bg-[var(--status-online)]' : 'bg-[var(--text)]'}`}></div>
                                                                <span className="truncate">{req}</span>
                                                            </div>
                                                            {userItems.length > 0 && (
                                                                <span className={`text-[8px] font-bold uppercase px-1 border border-[var(--border)] shrink-0 ${satisfied ? 'bg-[var(--status-online-bg)] text-[var(--status-online)]' : 'bg-[var(--bg-main)] text-[var(--text-muted)]'}`}>
                                                                    {satisfied ? 'IN CLOSET' : 'MISSING'}
                                                                </span>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>

                                        <RetroButton 
                                            onClick={() => onApply(template)} 
                                            className="w-full flex items-center justify-center gap-2 text-sm font-bold mt-2"
                                            variant="primary"
                                        >
                                            LOAD TEMPLATE <ArrowRight size={14} />
                                        </RetroButton>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </RetroWindow>
    );
};
